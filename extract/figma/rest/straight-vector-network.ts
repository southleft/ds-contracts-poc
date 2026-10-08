/** An observed centerline, not a contract shape. The graph supplies geometry;
 * the caller must separately qualify its parent allocation and native replay.
 * In particular, VECTOR stroke caps differ from Figma's native LINE caps. */
export interface StraightVectorObservation {
  nodeId: string;
  data: string;
  networkWidth: number;
  width: number;
  height: 0;
  scaleX: number;
  vertexOrder: number[];
  transform: number[][];
  constraints: { horizontal: string; vertical: string };
  strokeWeight: number;
  cap: 'NONE' | 'ROUND' | 'SQUARE';
  paint: Record<string, unknown>;
}

/** Strictly connected, monotone, horizontal open networks with zero tangents.
 * Preserve every observed vertex, normalized from the network's own extent
 * to the node's logical width. Never reverse-engineer a painted silhouette.
 * This observation is deliberately not enabled in the ordinary importer. */
export function observeStraightVectorNetwork(value: unknown):
  { observation: StraightVectorObservation } | { issue: string } {
  const reject = (reason: string) => ({ issue: `straight-vector-${reason}` });
  if (!value || typeof value !== 'object') return reject('node');
  const n = value as Record<string, any>;
  const bound = (v: unknown) => v && typeof v === 'object' && Object.keys(v).length > 0;
  const allowedBindings = (v: unknown, keys: string[]) => !bound(v) || Object.keys(v as object).every(k => keys.includes(k));
  const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 1e6;
  if (n.type !== 'VECTOR' || typeof n.id !== 'string' || !n.id || !positive(n.size?.x) || n.size?.y !== 0)
    return reject('logical-basis');
  const t = n.relativeTransform;
  if (!Array.isArray(t) || t.length !== 2 || t.some(r => !Array.isArray(r) || r.length !== 3 || r.some(v => typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1e6)) ||
      t[0][0] !== 1 || t[0][1] !== 0 || t[1][0] !== 0 || t[1][1] !== 1)
    return reject('transform');
  if (!n.constraints || !['LEFT', 'RIGHT', 'CENTER', 'SCALE', 'LEFT_RIGHT'].includes(n.constraints.horizontal) ||
      !['TOP', 'BOTTOM', 'CENTER', 'SCALE', 'TOP_BOTTOM'].includes(n.constraints.vertical)) return reject('constraints');
  if (!Array.isArray(n.strokes) || ['strokes', 'fills', 'effects'].some(k => n[k] !== undefined && (!Array.isArray(n[k]) || n[k].some((p: unknown) => !p || typeof p !== 'object')))) return reject('paint-shape');
  const paints = n.strokes?.filter((p: any) => p.visible !== false), paint = paints?.[0];
  if (n.isMask || n.children?.length || n.fills?.some((p: any) => p.visible !== false) ||
      n.effects?.some((p: any) => p.visible !== false) || (n.opacity ?? 1) !== 1 ||
      n.blendMode && !['NORMAL', 'PASS_THROUGH'].includes(n.blendMode) || n.strokeDashes?.length ||
      n.strokeAlign !== 'CENTER' || !positive(n.strokeWeight) || !['NONE', 'ROUND', 'SQUARE'].includes(n.strokeCap) ||
      paints?.length !== 1 || paint?.type !== 'SOLID' || !paint.color || (paint.opacity ?? 1) !== 1 || (paint.color.a ?? 1) !== 1 ||
      paint.blendMode && paint.blendMode !== 'NORMAL' || !['r', 'g', 'b'].every(k => typeof paint.color[k] === 'number' && Number.isFinite(paint.color[k]) && paint.color[k] >= 0 && paint.color[k] <= 1) ||
      !allowedBindings(n.boundVariables, ['strokes']) || !allowedBindings(paint.boundVariables, ['color']) ||
      bound(n.componentPropertyReferences) || bound(n.strokeOverrideTable) ||
      Object.values(n.fillOverrideTable ?? {}).some(v => v !== null) ||
      n.complexStrokeProperties && (n.complexStrokeProperties.strokeType !== 'BASIC' || Object.keys(n.complexStrokeProperties).some(k => k !== 'strokeType')))
    return reject('paint-or-override');
  const network = n.vectorNetwork;
  const vertices = network?.vertices, segments = network?.segments;
  if (!Array.isArray(vertices) || vertices.length < 2 || vertices.length > 512 || !Array.isArray(segments) ||
      segments.length !== vertices.length - 1 || network.regions !== undefined && network.regions !== null && (!Array.isArray(network.regions) || network.regions.length > 0)) return reject('graph');
  if (vertices.some(v => !v || !v.position || typeof v.position.x !== 'number' || !Number.isFinite(v.position.x) ||
      v.position.x < 0 || v.position.x > 1e6 || v.position.y !== 0)) return reject('vertices');
  const adj: number[][] = vertices.map(() => []);
  for (const edge of segments) {
    if (!edge || !Number.isInteger(edge.start) || !Number.isInteger(edge.end) || edge.start === edge.end ||
        !vertices[edge.start] || !vertices[edge.end] ||
        [edge.startTangent, edge.endTangent].some(t => !t || t.x !== 0 || t.y !== 0)) return reject('segments');
    adj[edge.start]!.push(edge.end); adj[edge.end]!.push(edge.start);
  }
  if (adj.some(a => a.length < 1 || a.length > 2)) return reject('branch-or-island');
  const ends = adj.flatMap((a, i) => a.length === 1 ? [i] : []).sort((a, b) => vertices[a].position.x - vertices[b].position.x);
  if (ends.length !== 2) return reject('endpoints');
  const order = [ends[0]!]; let previous = -1, current = ends[0]!;
  while (true) {
    const next = adj[current]!.find(i => i !== previous);
    if (next === undefined) break;
    if (order.includes(next)) return reject('cycle');
    order.push(next); previous = current; current = next;
  }
  if (order.length !== vertices.length || vertices[order[0]!].position.x !== 0 ||
      order.some((v, i) => i > 0 && vertices[v].position.x <= vertices[order[i - 1]!].position.x)) return reject('nonmonotone-or-disconnected');
  const networkWidth = vertices[order[order.length - 1]!].position.x;
  if (!positive(networkWidth)) return reject('network-basis');
  const scaleX = n.size.x / networkWidth;
  if (!Number.isFinite(scaleX) || scaleX <= 0) return reject('network-scale');
  const data = order.map((v, i) => `${i ? 'L' : 'M'}${vertices[v].position.x * scaleX} 0`).join(' ');
  return { observation: { nodeId: n.id, data, networkWidth, width: n.size.x, height: 0, scaleX,
    vertexOrder: order, transform: structuredClone(t), constraints: structuredClone(n.constraints),
    strokeWeight: n.strokeWeight, cap: n.strokeCap, paint: structuredClone(paint) } };
}
