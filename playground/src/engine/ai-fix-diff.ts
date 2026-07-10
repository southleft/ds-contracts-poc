/**
 * Plain-words DIFF SUMMARY for an AI fix round — what the returned contract
 * KEPT, RENAMED, and (loudly) REMOVED relative to the pre-fix contract.
 *
 * The owner field case this guards: Fix-with-AI resolved duplicate part
 * names by DELETING the parts — the rendered Dialog lost its close icon and
 * all four action buttons. Legal per schema, lossy in fact. The worker
 * prompt now forbids removal-as-fix and carries a machine-readable
 * `removals` declaration; this module is the CLIENT's own referee over the
 * same question — computed from the two contracts themselves, so an
 * UNDECLARED loss is caught regardless of what the model claims.
 *
 * Tolerant by design: both sides are parsed as loose JSON (the fixed
 * contract may not even satisfy the schema yet — the editor referees that
 * separately); a shape this walker cannot read contributes nothing rather
 * than throwing.
 */

export interface AiFixRename {
  from: string;
  to: string;
}

export interface AiFixDiff {
  /** One-liner for the ai-proposed strip: 'renamed 2 parts (Title → Title2,
   *  Icon → frame2Icon); removed NOTHING'. */
  summary: string;
  /** Everything present before and ABSENT after, with kind labels — renders
   *  loud/red when non-empty ('REMOVED 6 parts — review before trusting'). */
  lost: string[];
  /** Structural renames (a removed name whose part value re-appears verbatim
   *  under a new name). */
  renamed: AiFixRename[];
  /** Names present only AFTER that no rename accounts for. */
  added: string[];
}

interface Inventory {
  /** part name → serialized part value (rename matching). */
  parts: Map<string, string>;
  /** part name → kind label for the lost list. */
  kinds: Map<string, string>;
  props: Set<string>;
  events: Set<string>;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

function collectParts(parts: unknown, into: Inventory): void {
  if (!isObj(parts)) return;
  for (const [name, part] of Object.entries(parts)) {
    if (!isObj(part)) continue;
    into.parts.set(name, JSON.stringify(part));
    into.kinds.set(
      name,
      part.component !== undefined ? 'component ref' : part.slot !== undefined ? 'slot' : 'part',
    );
    collectParts(part.parts, into);
  }
}

function inventoryOf(contract: unknown): Inventory {
  const inv: Inventory = { parts: new Map(), kinds: new Map(), props: new Set(), events: new Set() };
  if (!isObj(contract)) return inv;
  collectParts(contract.anatomy, inv);
  if (Array.isArray(contract.props)) {
    for (const p of contract.props) if (isObj(p) && typeof p.name === 'string') inv.props.add(p.name);
  }
  if (Array.isArray(contract.events)) {
    for (const e of contract.events) if (isObj(e) && typeof e.name === 'string') inv.events.add(e.name);
  }
  return inv;
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** Diff the pre-fix contract against the AI round's returned contract. */
export function diffAiFixRound(pre: unknown, post: unknown): AiFixDiff {
  const before = inventoryOf(pre);
  const after = inventoryOf(post);

  const removedNames = [...before.parts.keys()].filter((n) => !after.parts.has(n));
  const addedNames = [...after.parts.keys()].filter((n) => !before.parts.has(n));

  // Structural rename detection: a removed part whose serialized value
  // re-appears VERBATIM under exactly one new name moved, it did not die.
  const renamed: AiFixRename[] = [];
  const claimedAdds = new Set<string>();
  for (const from of removedNames) {
    const value = before.parts.get(from)!;
    const matches = addedNames.filter((to) => !claimedAdds.has(to) && after.parts.get(to) === value);
    if (matches.length === 1) {
      renamed.push({ from, to: matches[0] });
      claimedAdds.add(matches[0]);
    }
  }
  const renamedFrom = new Set(renamed.map((r) => r.from));

  const lost: string[] = [];
  for (const name of removedNames) {
    if (renamedFrom.has(name)) continue;
    lost.push(`${before.kinds.get(name) ?? 'part'} "${name}"`);
  }
  for (const p of before.props) if (!after.props.has(p)) lost.push(`prop "${p}"`);
  for (const e of before.events) if (!after.events.has(e)) lost.push(`event "${e}"`);
  const added = addedNames.filter((n) => !claimedAdds.has(n));

  const clauses: string[] = [];
  if (renamed.length > 0) {
    clauses.push(
      `renamed ${plural(renamed.length, 'part')} (${renamed.map((r) => `${r.from} → ${r.to}`).join(', ')})`,
    );
  }
  if (added.length > 0) clauses.push(`added ${plural(added.length, 'part')} (${added.join(', ')})`);
  clauses.push(
    lost.length > 0
      ? `REMOVED ${lost.length} (${lost.join(', ')}) — review before trusting`
      : 'removed NOTHING',
  );

  return { summary: clauses.join('; '), lost, renamed, added };
}
