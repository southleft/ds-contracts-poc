/** What a designer changed on native nodes since they were last verified.
 *
 * A pure comparison of two readbacks of the SAME operation: the verified one
 * and a fresh one. It knows no component and no channel list: every recorded
 * value of every owned node is compared, so an edit this tool cannot carry is
 * still named instead of dropped. It authorizes nothing and changes nothing;
 * carrying a change to the contract or React is a separate, reviewed step. */
import { canonicalJson } from './contract-provenance.js';
import type { NativeSourceReadback } from './native-source-observation.js';

export interface NativeDesignChange {
  nodeId: string; node: string; variant?: string;
  /** A key of the node's recorded values, or `name`, `children`, `variantProperties`. */
  channel: string; recorded: unknown; observed: unknown;
}
export interface NativeDesignChanges {
  version: 1; kind: 'native-design-changes'; acceptedContract: null;
  changes: NativeDesignChange[]; added: string[]; removed: string[];
}
type Row = NonNullable<NativeSourceReadback['nodes']>[number] & { variantProperties?: Record<string, string> | null };

/** The Plugin API stores numbers as float32; a recorded 0.4 reads 0.4000000059604645. */
function equal(recorded: unknown, observed: unknown): boolean {
  if (typeof recorded === 'number' && typeof observed === 'number')
    return recorded === observed || Math.fround(recorded) === Math.fround(observed);
  if (Array.isArray(recorded) && Array.isArray(observed))
    return recorded.length === observed.length && recorded.every((value, index) => equal(value, observed[index]));
  if (recorded && observed && typeof recorded === 'object' && typeof observed === 'object' && !Array.isArray(recorded) && !Array.isArray(observed)) {
    const a = recorded as Record<string, unknown>, b = observed as Record<string, unknown>;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)].filter(key => a[key] !== undefined || b[key] !== undefined));
    return [...keys].every(key => equal(a[key], b[key]));
  }
  return canonicalJson(recorded ?? null) === canonicalJson(observed ?? null);
}

export function nativeDesignChanges(recorded: NativeSourceReadback, observed: NativeSourceReadback): NativeDesignChanges {
  if (!Array.isArray(recorded?.nodes) || !Array.isArray(observed?.nodes) || recorded.fileKey !== observed.fileKey ||
      recorded.operationId !== observed.operationId) throw Error('native-design-changes-readback-mismatch');
  const before = new Map((recorded.nodes as Row[]).map(row => [row.id, row])), after = new Map((observed.nodes as Row[]).map(row => [row.id, row]));
  if (before.size !== recorded.nodes.length || after.size !== observed.nodes.length) throw Error('native-design-changes-duplicate-node');
  // The nearest owning variant names the row for a reader; identity stays the node id.
  const variantOf = (row: Row | undefined, rows: Map<string, Row>): string | undefined => {
    for (let current = row, depth = 0; current && depth < 64; current = rows.get(current.parentId as string), depth++)
      if (current.type === 'COMPONENT') return current.name;
    return undefined;
  };
  const changes: NativeDesignChange[] = [];
  for (const [id, row] of before) {
    const now = after.get(id); if (!now) continue;
    const label = { nodeId: id, node: row.name, ...(variantOf(row, before) ? { variant: variantOf(row, before) } : {}) };
    const compare = (channel: string, a: unknown, b: unknown) => { if (!equal(a, b)) changes.push({ ...label, channel, recorded: a ?? null, observed: b ?? null }); };
    compare('name', row.name, now.name);
    compare('children', row.childIds, now.childIds);
    compare('variantProperties', row.variantProperties, now.variantProperties);
    const values = row.values as Record<string, unknown>, fresh = now.values as Record<string, unknown>;
    for (const channel of [...new Set([...Object.keys(values ?? {}), ...Object.keys(fresh ?? {})])].sort()) compare(channel, values?.[channel], fresh?.[channel]);
  }
  return { version: 1, kind: 'native-design-changes', acceptedContract: null, changes,
    added: [...after.keys()].filter(id => !before.has(id)).sort(), removed: [...before.keys()].filter(id => !after.has(id)).sort() };
}
