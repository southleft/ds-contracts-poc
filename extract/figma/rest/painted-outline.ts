import type { DumpNode } from '../types.js';
import type { RestNode } from './map.js';
import { paintedStrokeSvgObservation } from './stroke-svg.js';

/** An explicit fixed outline conversion. This does not preserve editable
 * stroke width: its provenance and the importer receipt say so. Keep original
 * path bytes and place a separate paint plane around their control hull. */
export function mapPaintedOutline(node: RestNode, parent: RestNode | null, svg: string, mapped: DumpNode): DumpNode | undefined {
  const identity = (t: number[][] | undefined) => t?.length === 2 && t.every(r => r.length === 3 && r.every(Number.isFinite)) &&
    t[0]![0] === 1 && t[0]![1] === 0 && t[1]![0] === 0 && t[1]![1] === 1;
  const strokes = node.strokes?.filter(p => p.visible !== false) ?? [], paint = strokes[0];
  const paths = (node as RestNode & { strokeGeometry?: Array<{ path: string; windingRule: 'NONZERO' | 'EVENODD' }> }).strokeGeometry;
  if (node.type !== 'VECTOR' || !parent || !['FRAME', 'COMPONENT'].includes(parent.type) ||
      parent.layoutMode && parent.layoutMode !== 'NONE' || !identity(parent.relativeTransform) || !identity(node.relativeTransform) ||
      !node.size || !parent.size || !mapped.abs || node.constraints?.horizontal !== 'LEFT' || node.constraints.vertical !== 'TOP' ||
      node.isMask || node.children?.length || node.fills?.some(p => p.visible !== false) || node.effects?.some(p => p.visible !== false) ||
      (node.opacity ?? 1) !== 1 || node.blendMode && !['NORMAL', 'PASS_THROUGH'].includes(node.blendMode) ||
      strokes.length !== 1 || !paint || paint.type !== 'SOLID' || !paint.color || !mapped.stroke ||
      (paint.opacity ?? 1) !== 1 || (paint.color.a ?? 1) !== 1 || paint.blendMode && paint.blendMode !== 'NORMAL' ||
      ![paint.color.r, paint.color.g, paint.color.b].every(v => Number.isFinite(v) && v >= 0 && v <= 1) ||
      Object.keys(node.boundVariables ?? {}).some(k => k !== 'strokes') ||
      Object.keys(paint.boundVariables ?? {}).some(k => k !== 'color') ||
      Object.keys(node.componentPropertyReferences ?? {}).length ||
      mapped.bound && Object.keys(mapped.bound).length || !paths || !Number.isFinite(node.strokeWeight) || node.strokeWeight! <= 0)
    return undefined;
  const strokeColor = '#' + [paint.color.r, paint.color.g, paint.color.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  const joined = paintedStrokeSvgObservation(svg, { nodeId: node.id, width: node.size.x, height: node.size.y, strokeColor, paths });
  if (!('observation' in joined)) return undefined;
  const numbers = paths[0]!.path.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)!.map(Number);
  const xs = numbers.filter((_, i) => i % 2 === 0), ys = numbers.filter((_, i) => i % 2 === 1);
  const x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys));
  const width = Math.ceil(Math.max(...xs)) - x, height = Math.ceil(Math.max(...ys)) - y;
  if (width <= 0 || height <= 0) return undefined;
  const ink: DumpNode = { name: 'Painted stroke ink', type: 'VECTOR', fill: structuredClone(mapped.stroke),
    ...(mapped.variableConsumers ? { variableConsumers: structuredClone(mapped.variableConsumers) } : {}),
    shape: { kind: 'path', width: node.size.x, height: node.size.y,
      paths: paths.map(p => ({ data: p.path, windingRule: p.windingRule })),
      x: -x, y: -y, right: width + x - node.size.x, bottom: height + y - node.size.y,
      constraints: { horizontal: 'SCALE', vertical: 'SCALE' } } };
  const plane: DumpNode = { name: 'Paint plane', type: 'FRAME', bbox: { width, height }, fixedSize: { width, height }, children: [ink] };
  const frame: DumpNode = { name: 'Outline bounds', type: 'FRAME', bbox: { width, height },
    abs: { x, y, width, height, right: node.size.x - x - width, bottom: node.size.y - y - height,
      constraints: { horizontal: 'LEFT', vertical: 'TOP' } }, children: [plane] };
  const result: DumpNode = { ...mapped, type: 'FRAME', bbox: { width: node.size.x, height: node.size.y }, children: [frame],
    paintedStrokeSource: { nodeId: node.id, strokeWeight: node.strokeWeight!, representation: 'fixed-outline' } };
  delete result.stroke; delete result.strokeWeight; delete result.strokeWeights; delete result.strokeAlign;
  delete result.cornerRadius; delete result.shape;
  return result;
}
