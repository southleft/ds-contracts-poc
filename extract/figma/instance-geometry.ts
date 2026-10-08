import type {DumpNode} from './types.js';

/** Capture a local affine witness without consulting the overrides list.
 * Preserve scale/reflection/skew as observations; consumers must qualify them.
 * Keep the canonical plugin function behavior identical (parity-tested). */
export function observeInstanceGeometry(nodeId: unknown, componentId: unknown, transform: unknown, width: unknown, height: unknown): DumpNode['instanceGeometry'] {
  if (typeof nodeId !== 'string' || !nodeId || typeof componentId !== 'string' || !componentId ||
      !Array.isArray(transform) || transform.length !== 2 ||
      !transform.every(row => Array.isArray(row) && row.length === 3 && row.every(value => typeof value === 'number' && Number.isFinite(value))) ||
      typeof width !== 'number' || !Number.isFinite(width) || width <= 0 ||
      typeof height !== 'number' || !Number.isFinite(height) || height <= 0) return undefined;
  return {nodeId, componentId, transform: transform.map(row => [...row]) as [[number, number, number], [number, number, number]], localSize: {width, height}};
}
