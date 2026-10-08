import type { DumpNode, DumpPropertyDefinition, DumpSet } from '../extract/figma/types.js';

/** Original component roots, before sanitation or semantic promotion. Duplicate
 * ids remain ambiguous; no arrival-order source can authorize another host. */
export interface FixedSwapOwnerRoot {
  setKey: string;
  node: DumpNode;
  propertyDefinitions?: Record<string, DumpPropertyDefinition>;
}
export function fixedSwapOwnerRoots(sets: readonly DumpSet[]): ReadonlyMap<string, readonly FixedSwapOwnerRoot[]> {
  const roots = new Map<string, FixedSwapOwnerRoot[]>();
  for (const set of sets) for (const node of set.variants) {
    if (!set.key || !node.nodeId) continue;
    const rows = roots.get(node.nodeId) ?? [];
    rows.push({setKey: set.key, node, propertyDefinitions: set.propertyDefinitions});
    roots.set(node.nodeId, rows);
  }
  return roots;
}

const dense = (value: unknown): value is unknown[] => Array.isArray(value) &&
  Array.from({length: value.length}, (_, i) => Object.hasOwn(value, i)).every(Boolean);
const identity = (value: unknown): value is number[][] => dense(value) && value.length === 2 &&
  value.every(row => dense(row) && row.length === 3 && row.every(cell => typeof cell === 'number' && Number.isFinite(cell))) &&
  (value[0] as number[])[0] === 1 && (value[0] as number[])[1] === 0 && (value[1] as number[])[0] === 0 && (value[1] as number[])[1] === 1;
const size = (value: unknown): value is {width: number; height: number} => !!value && typeof value === 'object' &&
  ['width', 'height'].every(key => Object.hasOwn(value, key) && typeof (value as Record<string, unknown>)[key] === 'number' &&
    Number.isFinite((value as Record<string, number>)[key]) && (value as Record<string, number>)[key] >= 0);
const sameSize = (a: unknown, b: unknown) => size(a) && size(b) && a.width === b.width && a.height === b.height;
const propertyName = (name: string) => name.replace(/#.*$/, '');

/** A descendant measurement is not an ordinary instance override. Join it to
 * the exact original owner main and its independently captured root authority.
 * This transports frozen local pixels only, never FILL/HUG or placement. */
export function qualifyFixedSwapRootAllocation(host: DumpNode, property: string,
  ownerSetKey: string, targetId: string, targetKey: string,
  roots: ReadonlyMap<string, readonly FixedSwapOwnerRoot[]> | undefined):
  {width: number; height: number; sizing: NonNullable<DumpNode['instanceSizing']>; remainingFields: string[]} | {issue: string} {
  const refuse = (issue: string) => ({issue});
  const swap = host.fixedSwaps?.[property], rows = swap?.observedInstances;
  const owner = host.instanceRootOverrides, hostGeometry = host.instanceGeometry;
  if (!host.nodeId || host.type !== 'INSTANCE' || host.instanceSetKey !== ownerSetKey ||
      owner?.nodeId !== host.nodeId || owner.componentSetKey !== ownerSetKey || owner.componentKey !== host.instanceKey ||
      !owner.componentId || hostGeometry?.nodeId !== host.nodeId || hostGeometry.componentId !== owner.componentId ||
      !size(hostGeometry.localSize) || (owner.localSize !== undefined && !sameSize(owner.localSize,hostGeometry.localSize)) ||
      !identity(owner.localTransform) || JSON.stringify(owner.localTransform) !== JSON.stringify(hostGeometry.transform))
    return refuse('host-identity-or-geometry');
  if (!swap || swap.id !== targetId || swap.key !== targetKey || !dense(rows) || rows.length !== 1)
    return refuse('selected-observation-missing-or-ambiguous');
  const row = rows[0] as NonNullable<typeof rows>[number], mains = roots?.get(owner.componentId);
  if (!dense(mains) || mains.length !== 1) return refuse('owner-main-missing-or-ambiguous');
  const main = mains[0] as FixedSwapOwnerRoot;
  const definitions = Object.entries(main.propertyDefinitions ?? {}).filter(([key]) => propertyName(key) === property);
  if (main.setKey !== ownerSetKey || main.node.nodeId !== owner.componentId || main.node.componentKey !== owner.componentKey || main.node.type !== 'COMPONENT' || definitions.length !== 1 || definitions[0][1].type !== 'INSTANCE_SWAP')
    return refuse('owner-property-identity');
  if (!row || row.componentId !== targetId || !dense(row.path) || row.path.length < 1 || row.path.length > 8 ||
      !row.path.every(index => typeof index === 'number' && Number.isSafeInteger(index) && index >= 0) ||
      !identity(row.relativeTransform) || !size(row.size) || !size(row.parentSize) ||
      !row.constraints || !Object.hasOwn(row.constraints,'horizontal') || !Object.hasOwn(row.constraints,'vertical') ||
      !['LEFT','RIGHT','CENTER'].includes(row.constraints.horizontal) || !['TOP','BOTTOM','CENTER'].includes(row.constraints.vertical))
    return refuse('selected-local-allocation');
  let leaf = main.node, parent: DumpNode | undefined;
  for (const index of row.path) {
    if (!dense(leaf.children) || index >= leaf.children.length) return refuse('selected-descendant-path');
    parent = leaf; leaf = leaf.children[index];
  }
  const targetRoots = roots?.get(targetId);
  if (!dense(targetRoots) || targetRoots.length !== 1) return refuse('selected-main-missing-or-ambiguous');
  const targetMain = targetRoots[0] as FixedSwapOwnerRoot;
  if (targetMain.setKey !== targetKey || targetMain.node.nodeId !== targetId || targetMain.node.componentKey !== targetKey || targetMain.node.type !== 'COMPONENT')
    return refuse('selected-main-identity');
  const w = leaf.instanceRootOverrides, g = leaf.instanceGeometry;
  if (!leaf.nodeId || row.nodeId !== `I${host.nodeId};${leaf.nodeId}` || leaf.type !== 'INSTANCE' ||
      leaf.instanceKey !== targetKey || leaf.instanceSetKey !== undefined || leaf.propRefs?.mainComponent !== property ||
      w?.nodeId !== leaf.nodeId || w.componentId !== targetId || w.componentKey !== targetKey || w.componentSetKey !== undefined ||
      g?.nodeId !== leaf.nodeId || g.componentId !== targetId || leaf.abs || leaf.bound?.width || leaf.bound?.height ||
      !dense(w.fields) || !w.fields.every(field => typeof field === 'string') || !['width', 'height'].every(field => w.fields.includes(field)) ||
      !sameSize(row.size, w.localSize) || !sameSize(row.size, g.localSize) || !sameSize(w.mainSize, targetMain.node.bbox) ||
      !identity(w.localTransform) || JSON.stringify(row.relativeTransform) !== JSON.stringify(w.localTransform) ||
      JSON.stringify(g.transform) !== JSON.stringify(w.localTransform) || (parent?.bbox !== undefined && !sameSize(row.parentSize, parent.bbox)))
    return refuse('selected-root-authority-or-join');
  const sizing = leaf.instanceSizing;
  if (!sizing || typeof sizing.horizontal !== 'string' || typeof sizing.vertical !== 'string' || !['FIXED', 'HUG', 'FILL'].includes(sizing.horizontal) || !['FIXED', 'HUG', 'FILL'].includes(sizing.vertical))
    return refuse('selected-sizing-unobserved');
  if (['width','height'].some((channel,i) => {
    const axis = i === 0 ? sizing.horizontal : sizing.vertical, value = sizing[channel as 'width'|'height'];
    return axis === 'FIXED' ? typeof value !== 'number' || !Number.isFinite(value) || value !== row.size![channel as 'width'|'height'] : Object.hasOwn(sizing,channel);
  })) return refuse('selected-sizing-dimension-conflict');
  return {width: row.size.width, height: row.size.height, sizing,
    remainingFields: w.fields.filter(field => field !== 'width' && field !== 'height')};
}
