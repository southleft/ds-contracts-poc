/** Observations of unresolved component usages, never an authored main API. */
import type {DumpNode} from '../extract/figma/types.js';

export const observedInstanceIdentity = (node: DumpNode): string | undefined =>
  node.instanceSetKey ? `set:${node.instanceSetKey}` : node.instanceKey ? `main:${node.instanceKey}` : undefined;

/** Include missing observations too: the first host cannot establish content
 * for a later host whose reader never captured its internals. */
export function observedInstanceGroups(roots: readonly DumpNode[]): ReadonlyMap<string, readonly DumpNode[]> {
  const groups = new Map<string, DumpNode[]>();
  const visit = (node: DumpNode) => {
    if (node.type === 'INSTANCE') {
      const key = observedInstanceIdentity(node);
      if (key) {
        const uses = groups.get(key) ?? []; uses.push(node); groups.set(key, uses);
      }
      return;
    }
    for (const child of node.children ?? []) visit(child);
  };
  roots.forEach(visit);
  return groups;
}

/** Revalidate the supplemental channel at consumption, including hand-edited
 * dumps. Dynamic property bindings and nested instances require their own
 * complete child contract; a static content snapshot cannot invent those. */
export function staticInstanceContent(node: DumpNode | undefined): boolean {
  let count = 0;
  const visit = (current: DumpNode, depth: number): boolean => {
    if (!current || typeof current !== 'object' || ++count > 128 || depth > 8 ||
        !['FRAME', 'GROUP', 'TEXT'].includes(current.type) || current.propRefs || current.instanceContent) return false;
    const children = current.children ?? [];
    return Array.isArray(children) && children.every(child => visit(child, depth + 1));
  };
  return !!node && node.type === 'FRAME' && Array.isArray(node.children) && node.children.length > 0 && visit(node, 0);
}
