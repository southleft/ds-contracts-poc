/**
 * Applying assist rename suggestions to minted provisional tokens.
 *
 * A rename is only ever a PROPOSAL (labeled ai-proposed in the UI); applying
 * one is deterministic and goes through the normal referees:
 *   · the minted leaf's VALUE moves to the new path in the live token layer
 *     (token-source.applyMintedRename — deduplicating into the base tree when
 *     the target already exists there),
 *   · the contract text's ref is rewritten, and the editor's validation pass
 *     referees the result — a bad proposal REFUSES by name, nothing retried.
 *
 * The wrinkle is axis-substituted refs: per-variant minted leaves
 * (imported.badge.root.background-color.info/.success/…) are bound in the
 * contract as ONE substituted ref `{imported.badge.root.background-color.
 * {variant}}`. Renaming a single leaf of that group would strand the others,
 * so grouped leaves apply as a GROUP: every leaf must have a rename, and the
 * proposed names must agree on a template (the axis value in the same
 * position, everything else identical) — otherwise the apply is refused with
 * the reason named. `{color.feedback.{variant}.background}` is exactly such
 * a template.
 */
import type { AssistRename } from './assist.js';
import { applyMintedRename } from './token-source.js';

const stripBraces = (s: string) => s.trim().replace(/^\{/, '').replace(/\}$/, '');

/** Axis-substituted minted refs present in the contract text:
 *  `{<groupBase>.{<axisProp>}}` → one entry per distinct group. */
export function substitutedGroupsIn(text: string): Map<string, string> {
  const groups = new Map<string, string>();
  for (const m of text.matchAll(/\{(imported\.[a-z0-9-]+(?:\.[a-z0-9-]+)*)\.\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g)) {
    groups.set(m[1], m[2]);
  }
  return groups;
}

export interface RenamePlanRow {
  /** Minted path (braces stripped). */
  from: string;
  /** Proposed semantic path (braces stripped). */
  to: string;
  rationale: string;
  kind: 'direct' | 'grouped';
  /** For grouped rows: the substitution group base and its axis prop. */
  groupBase?: string;
  groupAxis?: string;
  /** Named refusal — the row cannot apply, and this says why. */
  refused?: string;
}

/** Classify each AI rename against the CURRENT contract text and minted
 *  paths — direct ref rewrite, group member, or refused by name. */
export function planRenames(
  renames: AssistRename[],
  contractText: string,
  mintedPaths: Set<string>,
): RenamePlanRow[] {
  const groups = substitutedGroupsIn(contractText);
  return renames.map((r) => {
    const from = stripBraces(r.from);
    const to = stripBraces(r.to);
    const row: RenamePlanRow = { from, to, rationale: r.rationale ?? '', kind: 'direct' };
    if (!mintedPaths.has(from)) {
      return { ...row, refused: `"${from}" is not a minted leaf in the active layer — nothing to rename` };
    }
    if (from === to) {
      return { ...row, refused: 'the proposal keeps the same path — nothing to apply' };
    }
    if (contractText.includes(`{${from}}`)) return row;
    for (const [base, axis] of groups) {
      if (from.startsWith(`${base}.`) && !from.slice(base.length + 1).includes('.')) {
        return { ...row, kind: 'grouped', groupBase: base, groupAxis: axis };
      }
    }
    return {
      ...row,
      refused: `the contract text references neither {${from}} nor a substitution group containing it — nothing to rewrite`,
    };
  });
}

export interface ApplyOutcome {
  ok: boolean;
  /** The rewritten contract text (unchanged on refusal). */
  text: string;
  /** `from` paths this apply covered (a group apply covers every member). */
  appliedFrom: string[];
  /** Named notes: dedupes, group expansion. */
  notes: string[];
  /** Named refusal when !ok. */
  error?: string;
}

/** Apply one row (a grouped row applies its whole group). Pure over the text;
 *  the token layer moves through token-source.applyMintedRename. */
export function applyRenameRow(
  row: RenamePlanRow,
  allRows: RenamePlanRow[],
  contractText: string,
  mintedPaths: Set<string>,
): ApplyOutcome {
  const refuse = (error: string): ApplyOutcome => ({
    ok: false,
    text: contractText,
    appliedFrom: [],
    notes: [],
    error,
  });
  if (row.refused) return refuse(row.refused);

  if (row.kind === 'direct') {
    const moved = applyMintedRename(row.from, row.to);
    if (!moved.ok) return refuse(moved.error);
    return {
      ok: true,
      text: contractText.split(`{${row.from}}`).join(`{${row.to}}`),
      appliedFrom: [row.from],
      notes: moved.deduped
        ? [`{${row.to}} already exists in the active token source — deduplicated, the minted leaf retired`]
        : [],
    };
  }

  // Grouped: collect the sibling rows of the same substitution group.
  const base = row.groupBase!;
  const axis = row.groupAxis!;
  const members = allRows.filter((r) => r.kind === 'grouped' && r.groupBase === base && !r.refused);
  const memberFrom = new Set(members.map((m) => m.from));
  const groupLeaves = [...mintedPaths].filter(
    (p) => p.startsWith(`${base}.`) && !p.slice(base.length + 1).includes('.'),
  );
  const missing = groupLeaves.filter((p) => !memberFrom.has(p));
  if (missing.length > 0) {
    return refuse(
      `{${base}.{${axis}}} binds ${groupLeaves.length} leaves but the proposal covers ${members.length} — missing: ${missing.join(', ')}. Grouped leaves rename together or not at all.`,
    );
  }
  // Template: the axis value must sit at ONE consistent position; every other
  // segment must agree across members.
  const parsed = members.map((m) => ({
    axisValue: m.from.slice(base.length + 1),
    segs: m.to.split('.'),
  }));
  const len = parsed[0].segs.length;
  if (!parsed.every((p) => p.segs.length === len)) {
    return refuse('the proposed group names have different depths — no consistent template; grouped leaves rename together or not at all');
  }
  let template: string[] | null = null;
  for (let i = 0; i < len; i++) {
    const fits =
      parsed.every((p) => p.segs[i] === p.axisValue) &&
      parsed.every((p) => p.segs.every((s, j) => j === i || s === parsed[0].segs[j]));
    if (fits) {
      template = parsed[0].segs.map((s, j) => (j === i ? `{${axis}}` : s));
      break;
    }
  }
  if (!template) {
    return refuse(
      `the proposed names do not agree on a template (the ${axis} value in one position, everything else identical) — grouped leaves rename together or not at all`,
    );
  }
  const notes: string[] = [
    `group apply: {${base}.{${axis}}} covers ${members.length} leaves — all applied together`,
  ];
  for (const m of members) {
    const moved = applyMintedRename(m.from, m.to);
    if (!moved.ok) return refuse(`${m.from}: ${moved.error}`);
    if (moved.deduped) {
      notes.push(`{${m.to}} already exists in the active token source — deduplicated, the minted leaf retired`);
    }
  }
  return {
    ok: true,
    text: contractText.split(`{${base}.{${axis}}}`).join(`{${template.join('.')}}`),
    appliedFrom: members.map((m) => m.from),
    notes,
  };
}
