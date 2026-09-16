/** Figma may replace appended slot children with instance-derived IDs after a
 * plugin run. Roots and authored anatomy keep exact IDs. Only descendants of a
 * recorded comparison slot may use a durable allocation identity at the same
 * child path; neither names nor the latest receipt supply an expectation. */
import { canonicalJson } from "./contract-provenance.js";

type Row = Record<string, any>;
type Role = { slotId: string; path: number[] };
const same = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const key = (r: Role) => canonicalJson(r);

function roles(rows: Row[], slotIds: string[]): Map<string, Role> {
  const nodes = new Map(rows.map((n) => [n.id, n]));
  const result = new Map<string, Role>();
  function visit(id: string, parent: string, role: Role) {
    const node = nodes.get(id);
    if (!node || node.parentId !== parent || result.has(id))
      throw Error("slot topology");
    result.set(id, role);
    node.childIds.forEach((child: string, i: number) =>
      visit(child, id, { slotId: role.slotId, path: [...role.path, i] }),
    );
  }
  for (const slotId of slotIds) {
    const slot = nodes.get(slotId);
    if (!slot || slot.type !== "SLOT") throw Error("slot missing");
    slot.childIds.forEach((child: string, i: number) =>
      visit(child, slotId, { slotId, path: [i] }),
    );
  }
  return result;
}

export function resolveNativeSlotIdentities(
  creation: Row,
  rows: Row[],
  /** Only a prior readback independently verified against the original exact
   * creation IDs can bridge older receipts that lack allocation stamps. */
  anchorRows?: Row[],
): Row[] | null {
  try {
    const born = new Map<string, Row>(
      creation.nodes.map((n: Row) => [n.id, n]),
    );
    const slotIds: string[] = creation.comparisons.flatMap((c: Row) =>
      c.status === "created-comparison"
        ? c.slots.map((s: Row) => s.nodeId)
        : [],
    );
    if (new Set(slotIds).size !== slotIds.length) return null;
    const liveRoles = roles(rows, slotIds);
    const anchorRoles = anchorRows
      ? roles(anchorRows, slotIds)
      : new Map<string, Role>();
    const anchors = new Map((anchorRows ?? []).map((n) => [n.id, n]));
    const expectedByRole = new Map<string, string>();
    for (const n of creation.nodes) {
      const role = n.slotIdentity ?? anchorRoles.get(n.id);
      if (!role) continue;
      if (
        !slotIds.includes(role.slotId) ||
        !Array.isArray(role.path) ||
        !role.path.length ||
        role.path.some(
          (i: unknown) => !Number.isSafeInteger(i) || (i as number) < 0,
        )
      )
        return null;
      if (
        n.slotIdentity &&
        anchorRoles.has(n.id) &&
        !same(n.slotIdentity, anchorRoles.get(n.id))
      )
        return null;
      if (expectedByRole.has(key(role))) return null;
      expectedByRole.set(key(role), n.id);
    }
    const aliases = new Map<string, string>();
    const used = new Set<string>();
    for (const n of rows) {
      let id = n.id;
      if (!born.has(id)) {
        const role = liveRoles.get(id);
        if (!role || !id.startsWith(`${role.slotId};`)) return null;
        const expected = expectedByRole.get(key(role));
        if (!expected) return null;
        const original = born.get(expected)!;
        if (original.slotIdentity) {
          if (n.metadata.nativeSourceAllocation !== expected) return null;
        } else {
          const anchor = anchors.get(expected);
          if (
            !anchor ||
            !anchor.metadata.nativeSourceSample ||
            !same(
              n.metadata.nativeSourceSample,
              anchor.metadata.nativeSourceSample,
            ) ||
            !same(
              n.metadata.nativeSourceOperation,
              anchor.metadata.nativeSourceOperation,
            )
          )
            return null;
        }
        if (
          n.type !== original.type ||
          (original.key && original.key !== n.key)
        )
          return null;
        id = expected;
      }
      if (used.has(id)) return null;
      used.add(id);
      aliases.set(n.id, id);
      const original = born.get(id)!;
      if (
        original.slotIdentity &&
        (!same(liveRoles.get(n.id), original.slotIdentity) ||
          n.metadata.nativeSourceAllocation !== id)
      )
        return null;
    }
    if (used.size !== born.size) return null;
    // Keep the raw journal unchanged. This local view changes references only;
    // all observed ownership, properties and source semantics are still checked.
    return rows.map((n) => ({
      ...n,
      id: aliases.get(n.id),
      parentId: aliases.get(n.parentId) ?? n.parentId,
      childIds: n.childIds.map((id: string) => aliases.get(id) ?? id),
    }));
  } catch {
    return null;
  }
}
