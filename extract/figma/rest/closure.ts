/**
 * DEPENDENCY CLOSURE for the REST import — "a REST import follows its
 * instances".
 *
 * RULE. Every component set referenced by an INSTANCE inside an imported set
 * (transitively) that lives in the SAME file is fetched and mapped into the
 * same dump, so the proposer resolves those instances to REAL child contracts
 * instead of auto-proposed geometry-only stubs. A reference that cannot be
 * followed stays a stub, and WHY is named per reference:
 *
 *   remote-library-component  the response's components metadata says
 *                             `remote: true` — the main component lives in a
 *                             library file this import did not read
 *   not-found                 no metadata for the componentId in the response,
 *                             or /nodes answered null for the target id
 *   not-a-component           the target id is not a COMPONENT_SET/COMPONENT
 *   utility-slot-set          the target is named "Slot" — a utility the
 *                             mapper never maps (dump.plugin.js rule)
 *   set-name-collision        another set already in the dump has the same
 *                             name (the dump is keyed by set name)
 *   unreadable                the /nodes request for the target failed
 *   cap-exceeded              following it would pull more than
 *                             CLOSURE_SET_CAP sets
 *
 * WHICH instances. The INSTANCE nodes the mapper itself maps — every INSTANCE
 * inside a variant that is NOT inside another INSTANCE. The mapper never
 * recurses into an instance (map.ts: "instance internals belong to the child
 * contract"), so a set referenced only from INSIDE an instance subtree has no
 * reference in the dump to resolve; it is reached through the child's own
 * definition when the child is followed (transitivity), or not at all.
 *
 * ORDER. The merged response lists sets DEPENDENCIES FIRST (a post-order walk
 * from the requested ids, each set's targets visited in id order) because the
 * proposer session-links a set only to siblings proposed EARLIER in the batch
 * (core/propose-figma.ts proposeBatchFromDump). Fetch rounds visit targets in
 * sorted id order, so the dump is byte-stable across runs. A cycle (A → B →
 * A) is cut where the walk re-enters a set already on its stack and named in
 * `cycles`; the set proposed first then references the other as a stub the
 * CLI never writes (the real contract claims the id).
 *
 * Browser-pure: no node builtins; the fetch is injected.
 */
import type { RestNode, RestNodesResponse } from "./map.js";

/** At most this many sets are PULLED by closure (requested sets not counted).
 *  A reference whose set would exceed it stays a stub, named `cap-exceeded`
 *  — never a silent truncation. */
export const CLOSURE_SET_CAP = 64;
/** Ids per /v1/files/:key/nodes request on a closure round (the batching
 *  extract/figma/visual-truth/rest.mjs already uses: IDS_PER_CALL = 30). */
export const CLOSURE_IDS_PER_REQUEST = 30;

export type ClosureUnresolvedReason =
  | "remote-library-component"
  | "not-found"
  | "not-a-component"
  | "utility-slot-set"
  | "set-name-collision"
  | "unreadable"
  | "cap-exceeded";

export interface ClosureSet {
  nodeId: string;
  name: string;
  type: string;
}

export interface ClosurePulledSet extends ClosureSet {
  /** 1 = referenced by a requested set; n = n hops away. */
  round: number;
  /** Names of the dump sets whose instances reference it (sorted). */
  referencedBy: string[];
}

export interface ClosureUnresolved {
  /** The set id (or standalone component id) the references point at. */
  targetId: string;
  /** The main component ids the instances name (sorted). */
  componentIds: string[];
  /** The component's (or its set's) name from the response metadata, when any. */
  name?: string;
  reason: ClosureUnresolvedReason;
  detail: string;
  /** Every referencing instance, as a mapper node path (sorted, unique). */
  referencedFrom: string[];
}

/** `_provenance.closure` — what the import requested, what it followed, and
 *  every reference it could not follow, by reason. */
export interface DumpClosure {
  rule: "follow-instances";
  cap: number;
  requested: ClosureSet[];
  pulled: ClosurePulledSet[];
  unresolved: ClosureUnresolved[];
  /** Each cut back-edge as [from set name, to set name]. */
  cycles: Array<[string, string]>;
}

type Entry = NonNullable<RestNodesResponse["nodes"][string]>;

export type FetchNodesBatch = (ids: string[]) => Promise<RestNodesResponse>;

interface InstanceRef {
  componentId: string | undefined;
  nodePath: string;
}

/** The INSTANCE nodes the mapper maps — never descending into an instance —
 *  with the same node path spelling (`Set:Variant/child/…`). */
export function mappedInstanceRefs(doc: RestNode): InstanceRef[] {
  const out: InstanceRef[] = [];
  const walk = (node: RestNode, nodePath: string) => {
    if (node.type === "INSTANCE") {
      out.push({
        componentId: (node as { componentId?: string }).componentId,
        nodePath,
      });
      return;
    }
    for (const child of node.children ?? [])
      walk(child, `${nodePath}/${child.name}`);
  };
  if (doc.type === "COMPONENT_SET") {
    for (const variant of doc.children ?? [])
      walk(variant, `${doc.name}:${variant.name}`);
  } else {
    walk(doc, `${doc.name}:${doc.name}`);
  }
  return out;
}

const isSetDoc = (doc: RestNode | undefined): boolean =>
  doc?.type === "COMPONENT_SET" || doc?.type === "COMPONENT";
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Follow the instances of the sets in `first` to a fixpoint. `requestedIds`
 * is the order the caller asked for; `fetchBatch` performs one /nodes request.
 * Returns the merged response (dependencies first) and the closure record.
 */
export async function followInstances(
  first: RestNodesResponse,
  requestedIds: string[],
  fetchBatch: FetchNodesBatch,
  opts: { cap?: number; idsPerRequest?: number } = {},
): Promise<{ response: RestNodesResponse; closure: DumpClosure }> {
  const cap = opts.cap ?? CLOSURE_SET_CAP;
  const perRequest = opts.idsPerRequest ?? CLOSURE_IDS_PER_REQUEST;

  const entries = new Map<string, Entry>(); // id → entry of every set in the dump
  const origin = new Map<string, number>(); // id → round (0 = requested)
  const nameOwner = new Map<string, string>(); // set name → id
  const edges = new Map<string, Set<string>>(); // set id → target set ids in the dump
  const referencedBy = new Map<string, Set<string>>(); // target id → referencing set names
  const failed = new Map<
    string,
    { reason: ClosureUnresolvedReason; detail: string }
  >();
  const unresolved = new Map<string, ClosureUnresolved>(); // `${targetId}` → record

  const requested: ClosureSet[] = [];
  for (const id of requestedIds) {
    const entry = first.nodes?.[id];
    if (!entry || !isSetDoc(entry.document) || entries.has(id)) continue;
    entries.set(id, entry);
    origin.set(id, 0);
    if (!nameOwner.has(entry.document.name))
      nameOwner.set(entry.document.name, id);
    requested.push({
      nodeId: id,
      name: entry.document.name,
      type: entry.document.type,
    });
  }

  const noteUnresolved = (
    targetId: string,
    componentId: string,
    name: string | undefined,
    reason: ClosureUnresolvedReason,
    detail: string,
    nodePath: string,
  ) => {
    const rec = unresolved.get(targetId) ?? {
      targetId,
      componentIds: [],
      ...(name ? { name } : {}),
      reason,
      detail,
      referencedFrom: [],
    };
    if (!rec.componentIds.includes(componentId))
      rec.componentIds.push(componentId);
    if (!rec.referencedFrom.includes(nodePath))
      rec.referencedFrom.push(nodePath);
    unresolved.set(targetId, rec);
  };

  let frontier = [...requested.map((r) => r.nodeId)];
  let round = 0;
  let pulledCount = 0;
  while (frontier.length > 0) {
    round += 1;
    // target id → the references that point at it this round
    const pending = new Map<
      string,
      Array<{
        componentId: string;
        nodePath: string;
        name?: string;
        from: string;
      }>
    >();
    for (const setId of frontier) {
      const entry = entries.get(setId)!;
      const setName = entry.document.name;
      for (const ref of mappedInstanceRefs(entry.document)) {
        const cid = ref.componentId ?? "(absent)";
        const meta = ref.componentId
          ? entry.components?.[ref.componentId]
          : undefined;
        if (!meta) {
          noteUnresolved(
            cid,
            cid,
            undefined,
            "not-found",
            `componentId ${cid} has no entry in the response's components map — the main component could not be located`,
            ref.nodePath,
          );
          continue;
        }
        const setMeta = meta.componentSetId
          ? (entry.componentSets?.[meta.componentSetId] as
              { name?: string; remote?: boolean } | undefined)
          : undefined;
        const targetId = meta.componentSetId ?? cid;
        const targetName = setMeta?.name ?? meta.name;
        if (
          (meta as { remote?: boolean }).remote === true ||
          setMeta?.remote === true
        ) {
          noteUnresolved(
            targetId,
            cid,
            targetName,
            "remote-library-component",
            `"${targetName}" is a remote (library) component — its main lives in another file this import did not read`,
            ref.nodePath,
          );
          continue;
        }
        if (entries.has(targetId)) {
          if (targetId !== setId) {
            (edges.get(setId) ?? edges.set(setId, new Set()).get(setId)!).add(
              targetId,
            );
            (
              referencedBy.get(targetId) ??
              referencedBy.set(targetId, new Set()).get(targetId)!
            ).add(setName);
          }
          continue;
        }
        const known = failed.get(targetId);
        if (known) {
          noteUnresolved(
            targetId,
            cid,
            targetName,
            known.reason,
            known.detail,
            ref.nodePath,
          );
          continue;
        }
        const list = pending.get(targetId) ?? [];
        list.push({
          componentId: cid,
          nodePath: ref.nodePath,
          ...(targetName ? { name: targetName } : {}),
          from: setId,
        });
        pending.set(targetId, list);
      }
    }
    const targets = [...pending.keys()].sort(byString);
    const room = Math.max(0, cap - pulledCount);
    const toFetch = targets.slice(0, room);
    for (const id of targets.slice(room)) {
      const detail = `following it would pull more than the closure cap of ${cap} sets (CLOSURE_SET_CAP) — refused by name, not fetched; import it by its own node-id, or run with --no-closure`;
      failed.set(id, { reason: "cap-exceeded", detail });
      for (const r of pending.get(id)!)
        noteUnresolved(
          id,
          r.componentId,
          r.name,
          "cap-exceeded",
          detail,
          r.nodePath,
        );
    }
    const next: string[] = [];
    for (let i = 0; i < toFetch.length; i += perRequest) {
      const batch = toFetch.slice(i, i + perRequest);
      let response: RestNodesResponse | undefined;
      let error: string | undefined;
      try {
        response = await fetchBatch(batch);
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
      for (const id of batch) {
        const refs = pending.get(id)!;
        const entry = response?.nodes?.[id] ?? null;
        let reason: ClosureUnresolvedReason | undefined;
        let detail = "";
        if (error !== undefined) {
          reason = "unreadable";
          detail = `GET /nodes for ${id} failed: ${error.slice(0, 200)}`;
        } else if (!entry) {
          reason = "not-found";
          detail = `GET /nodes answered null for ${id} — the node is not in this file`;
        } else if (!isSetDoc(entry.document)) {
          reason = "not-a-component";
          detail = `${id} "${entry.document.name}" is a ${entry.document.type}, not a COMPONENT_SET or COMPONENT`;
        } else if (entry.document.name === "Slot") {
          reason = "utility-slot-set";
          detail = `${id} is the utility set "Slot", which the mapper never maps`;
        } else if (nameOwner.has(entry.document.name)) {
          reason = "set-name-collision";
          detail = `${id} "${entry.document.name}" has the same name as set ${nameOwner.get(entry.document.name)} already in this dump (the dump is keyed by set name)`;
        }
        if (reason) {
          failed.set(id, { reason, detail });
          for (const r of refs)
            noteUnresolved(
              id,
              r.componentId,
              r.name,
              reason,
              detail,
              r.nodePath,
            );
          continue;
        }
        entries.set(id, entry!);
        origin.set(id, round);
        nameOwner.set(entry!.document.name, id);
        pulledCount += 1;
        next.push(id);
        for (const r of refs) {
          (edges.get(r.from) ?? edges.set(r.from, new Set()).get(r.from)!).add(
            id,
          );
          (
            referencedBy.get(id) ?? referencedBy.set(id, new Set()).get(id)!
          ).add(entries.get(r.from)!.document.name);
        }
      }
    }
    frontier = next;
  }

  // Dependencies first: post-order from each requested id, targets in id order.
  const order: string[] = [];
  const done = new Set<string>();
  const onStack = new Set<string>();
  const cycles: Array<[string, string]> = [];
  const visit = (id: string) => {
    if (done.has(id)) return;
    onStack.add(id);
    for (const target of [...(edges.get(id) ?? [])].sort(byString)) {
      if (onStack.has(target)) {
        cycles.push([
          entries.get(id)!.document.name,
          entries.get(target)!.document.name,
        ]);
        continue;
      }
      visit(target);
    }
    onStack.delete(id);
    done.add(id);
    order.push(id);
  };
  for (const r of requested) visit(r.nodeId);

  const nodes: RestNodesResponse["nodes"] = {};
  for (const id of order) nodes[id] = entries.get(id)!;
  // Requested ids that were not sets (or null) keep their slot so the mapper
  // still names them exactly as it does without closure.
  for (const id of requestedIds)
    if (!(id in nodes) && first.nodes && id in first.nodes)
      nodes[id] = first.nodes[id];

  const pulled: ClosurePulledSet[] = order
    .filter((id) => (origin.get(id) ?? 0) > 0)
    .map((id) => ({
      nodeId: id,
      name: entries.get(id)!.document.name,
      type: entries.get(id)!.document.type,
      round: origin.get(id)!,
      referencedBy: [...(referencedBy.get(id) ?? [])].sort(byString),
    }));
  const closure: DumpClosure = {
    rule: "follow-instances",
    cap,
    requested,
    pulled,
    unresolved: [...unresolved.values()]
      .map((u) => ({
        ...u,
        componentIds: [...u.componentIds].sort(byString),
        referencedFrom: [...u.referencedFrom].sort(byString),
      }))
      .sort((a, b) => byString(a.targetId, b.targetId)),
    cycles,
  };
  return {
    response: {
      ...(first.name !== undefined ? { name: first.name } : {}),
      nodes,
    },
    closure,
  };
}

/** The per-reference rows the mapper writes into `_degradations` (code
 *  `instance-closure-unresolved`), one per referencing instance path. */
export function closureDegradations(closure: DumpClosure): Array<{
  code: "instance-closure-unresolved";
  nodePath: string;
  field: string;
  message: string;
}> {
  const rows: Array<{
    code: "instance-closure-unresolved";
    nodePath: string;
    field: string;
    message: string;
  }> = [];
  for (const u of closure.unresolved) {
    for (const nodePath of u.referencedFrom) {
      rows.push({
        code: "instance-closure-unresolved",
        nodePath,
        field: "instanceOf",
        message: `${u.reason}: ${u.detail} — the instance stays an auto-proposed stub`,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// The proposer's side: a closure-pulled child that refuses
// ---------------------------------------------------------------------------

export interface SkippedLike {
  setName: string;
  reason: string;
  detail?: string;
}

/**
 * AGENT decision (docs/23 §D.43): a set the CLOSURE pulled in that refuses to
 * propose does NOT refuse the import. Its references fall back to today's
 * auto-proposed stub, and the fall-back is named
 * `closure-child-refused:<set>:<reason>`. A REQUESTED set's refusal still
 * refuses exactly as before. Reverse: return every skip as `refused`.
 */
export function partitionClosureRefusals(
  skipped: SkippedLike[],
  closure: Pick<DumpClosure, "pulled"> | undefined,
): {
  refused: SkippedLike[];
  closureChildren: Array<SkippedLike & { note: string }>;
} {
  const pulledNames = new Set((closure?.pulled ?? []).map((p) => p.name));
  const refused: SkippedLike[] = [];
  const closureChildren: Array<SkippedLike & { note: string }> = [];
  for (const skip of skipped) {
    if (!pulledNames.has(skip.setName)) {
      refused.push(skip);
      continue;
    }
    const oneLine = `${skip.reason}${skip.detail ? ` — ${skip.detail}` : ""}`
      .replace(/\s+/g, " ")
      .trim();
    closureChildren.push({
      ...skip,
      note: `closure-child-refused:${skip.setName}:${oneLine} — the set was pulled in by the dependency closure and could not be proposed; every instance of it stays an auto-proposed stub`,
    });
  }
  return { refused, closureChildren };
}

/** Read `_provenance.closure` off a parsed dump, when a closure ran. */
export function dumpClosure(dump: {
  _provenance?: unknown;
}): DumpClosure | undefined {
  const c = (dump._provenance as { closure?: unknown } | undefined)?.closure;
  return c &&
    typeof c === "object" &&
    (c as DumpClosure).rule === "follow-instances"
    ? (c as DumpClosure)
    : undefined;
}
