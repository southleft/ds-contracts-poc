/** Figma may replace slot children with instance-derived IDs. Resolve only
 * recorded topology and durable allocation identities; never match by name. */
import { canonicalJson } from './contract-provenance.js';
type Row = Record<string, any>;
type Resolver = (creation: Row, rows: Row[], anchorRows?: Row[]) => Row[] | null;

// One static implementation serves the host and generated native script. Keep
// it as source text: bundlers rename free variables in Function.toString(),
// which makes a serialized host function unsafe to execute in another VM.
const SLOT_IDENTITY_RUNTIME = `const same = (a, b) => canonicalJson(a) === canonicalJson(b);
const key = (r) => canonicalJson(r);
function roles(rows, slotIds) {
  const nodes = new Map(rows.map((n) => [n.id, n]));
  const result = /* @__PURE__ */ new Map();
  function visit(id, parent, role) {
    const node = nodes.get(id);
    if (!node || node.parentId !== parent || result.has(id))
      throw Error("slot topology");
    result.set(id, role);
    node.childIds.forEach(
      (child, i) => visit(child, id, { slotId: role.slotId, path: [...role.path, i] })
    );
  }
  for (const slotId of slotIds) {
    const slot = nodes.get(slotId);
    if (!slot || slot.type !== "SLOT") throw Error("slot missing");
    slot.childIds.forEach(
      (child, i) => visit(child, slotId, { slotId, path: [i] })
    );
  }
  return result;
}
function resolveNativeSlotIdentities(creation, rows, anchorRows) {
  try {
    const born = new Map(
      creation.nodes.map((n) => [n.id, n])
    );
    const slotIds = creation.comparisons.flatMap(
      (c) => c.status === "created-comparison" ? c.slots.map((s) => s.nodeId) : []
    );
    if (new Set(slotIds).size !== slotIds.length) return null;
    const liveRoles = roles(rows, slotIds);
    const anchorRoles = anchorRows ? roles(anchorRows, slotIds) : /* @__PURE__ */ new Map();
    const anchors = new Map((anchorRows ?? []).map((n) => [n.id, n]));
    const expectedByRole = /* @__PURE__ */ new Map();
    for (const n of creation.nodes) {
      const role = n.slotIdentity ?? anchorRoles.get(n.id);
      if (!role) continue;
      if (!slotIds.includes(role.slotId) || !Array.isArray(role.path) || !role.path.length || role.path.some(
        (i) => !Number.isSafeInteger(i) || i < 0
      ))
        return null;
      if (n.slotIdentity && anchorRoles.has(n.id) && !same(n.slotIdentity, anchorRoles.get(n.id)))
        return null;
      if (expectedByRole.has(key(role))) return null;
      expectedByRole.set(key(role), n.id);
    }
    const aliases = /* @__PURE__ */ new Map();
    const used = /* @__PURE__ */ new Set();
    for (const n of rows) {
      let id = n.id;
      if (!born.has(id)) {
        const role = liveRoles.get(id);
        if (!role || !id.startsWith(\`\${role.slotId};\`)) return null;
        const expected = expectedByRole.get(key(role));
        if (!expected) return null;
        const original2 = born.get(expected);
        if (original2.slotIdentity) {
          if (n.metadata.nativeSourceAllocation !== expected) return null;
        } else {
          const anchor = anchors.get(expected);
          if (!anchor || !anchor.metadata.nativeSourceSample || !same(
            n.metadata.nativeSourceSample,
            anchor.metadata.nativeSourceSample
          ) || !same(
            n.metadata.nativeSourceOperation,
            anchor.metadata.nativeSourceOperation
          ))
            return null;
        }
        if (n.type !== original2.type || original2.key && original2.key !== n.key)
          return null;
        id = expected;
      }
      if (used.has(id)) return null;
      used.add(id);
      aliases.set(n.id, id);
      const original = born.get(id);
      if (original.slotIdentity && (!same(liveRoles.get(n.id), original.slotIdentity) || n.metadata.nativeSourceAllocation !== id))
        return null;
    }
    if (used.size !== born.size) return null;
    return rows.map((n) => ({
      ...n,
      id: aliases.get(n.id),
      parentId: aliases.get(n.parentId) ?? n.parentId,
      childIds: n.childIds.map((id) => aliases.get(id) ?? id)
    }));
  } catch {
    return null;
  }
}
`;

/** The caller provides canonicalJson; all other bindings are self-contained. */
export function nativeSlotIdentityRuntime(): string { return SLOT_IDENTITY_RUNTIME; }

const resolve: Resolver = new Function('canonicalJson',
  SLOT_IDENTITY_RUNTIME + ';return resolveNativeSlotIdentities;')(canonicalJson);
export function resolveNativeSlotIdentities(creation: Row, rows: Row[], anchorRows?: Row[]): Row[] | null {
  return resolve(creation, rows, anchorRows);
}

/** Figma also re-identifies caller content placed in a nested instance's slot
 * after a save or reload: a born `12:34` reads back as `I<instance>;<slot>;<n>`.
 * Contract-draft graphs record no slot roles, so resolve those rows only by
 * their durable allocation stamp, born type/key and live slot topology under a
 * born instance. Inherited main sublayers keep their main's stamp and are not
 * candidates: a row is caller content only when its nearest SLOT-or-INSTANCE
 * ancestor is a SLOT. Names are never consulted. Returns null on a duplicate
 * or unrelated stamp so the caller refuses instead of guessing. */
export function resolveNativeGraphSlotIdentities(creation: Row, rows: Row[]): Row[] | null {
  try {
    const born = new Map<string, Row>(creation.nodes.map((n: Row) => [n.id, n]));
    const live = new Map<string, Row>(rows.map((n) => [n.id, n]));
    if (live.size !== rows.length) return null;
    const bornInstance = (row: Row | undefined) => {
      if (!row || row.type !== 'INSTANCE') return false;
      if (born.has(row.id)) return born.get(row.id)!.type === 'INSTANCE';
      const stamp = row.metadata?.nativeSourceAllocation;
      return typeof stamp === 'string' && born.get(stamp)?.type === 'INSTANCE';
    };
    const boundary = (row: Row) => {
      const seen = new Set<string>([row.id]);
      for (let cursor = live.get(row.parentId); cursor && !seen.has(cursor.id); cursor = live.get(cursor.parentId)) {
        seen.add(cursor.id);
        if (cursor.type === 'SLOT' || cursor.type === 'INSTANCE') return cursor;
      }
      return undefined;
    };
    const aliases = new Map<string, string>();
    const claimed = new Set<string>();
    for (const n of rows) {
      if (born.has(n.id)) continue;
      const slot = boundary(n);
      if (!slot || slot.type !== 'SLOT') continue;
      const stamp = n.metadata?.nativeSourceAllocation;
      if (typeof stamp !== 'string' || !born.has(stamp)) continue;
      // A library default is an owned INSTANCE on its main's slot and an
      // inherited copy in each enclosing instance. It is not a re-identified
      // caller allocation. The version-2 verifier subsequently checks the
      // complete main/instance topology and every default-slot stamp.
      if (creation.graphVerification === 2 && live.has(stamp) && n.type === 'INSTANCE' &&
          born.get(stamp)?.type === 'INSTANCE' && bornInstance(boundary(slot))) {
        const part = JSON.parse(n.metadata?.nativeContractPart ?? 'null');
        if (Number.isInteger(part?.defaultSlotIndex) && part.defaultSlotIndex >= 0 &&
            n.metadata.nativeContractPart === live.get(stamp)!.metadata?.nativeContractPart) continue;
      }
      // A stamped copy beside its still-present original is a duplicate.
      if (live.has(stamp) || claimed.has(stamp)) return null;
      const original = born.get(stamp)!;
      if (n.type !== original.type || (original.key && original.key !== n.key)) return null;
      // The slot owns the re-identified ID and sits inside an instance that
      // this operation created (directly or through the same bridge).
      if (!n.id.startsWith(`${slot.id};`) || !bornInstance(boundary(slot))) return null;
      claimed.add(stamp);
      aliases.set(n.id, stamp);
    }
    if (!aliases.size) return rows;
    return rows.map((n) => ({
      ...n,
      id: aliases.get(n.id) ?? n.id,
      parentId: aliases.get(n.parentId) ?? n.parentId,
      childIds: n.childIds.map((id: string) => aliases.get(id) ?? id),
    }));
  } catch {
    return null;
  }
}
