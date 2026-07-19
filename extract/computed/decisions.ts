/**
 * COMPUTED-CAPTURE FLOOR — decision re-application (Round 4).
 *
 * decisions.json entries are HUMAN-ACKED computed-wins resolutions
 * (extract/computed/resolve.ts, explicit `--apply` only). Round 4 re-fuses
 * every component (anatomy promotion), which regenerates the enriched
 * contract — the acked decisions must ride along or the gate re-scores the
 * very contradictions a human already resolved (Banner's tone map painting
 * the whole card was exactly this).
 *
 * This module re-applies committed decisions onto a freshly fused enriched
 * contract by (part, channel, scope, to) — the recorded resolution shape —
 * with resolve.ts's exact semantics:
 *   · scope 'base': the channel rebinds at the part's base tokens AND every
 *     per-value override of the channel is stripped (base scope is only
 *     reached when every combo contradicts — the overrides are contradicted
 *     by definition; leaving them would beat the resolved base in the
 *     cascade).
 *   · scope 'axis:prop=v1|v2': the channel rebinds per named value via a
 *     tokensByProp entry (reusing the same-prop entry when one exists).
 *
 * A decision naming a part the promoted anatomy no longer has is a NAMED
 * skip (never silent) — the caller quotes skips in the ledger.
 */
import { tokensByPropEntries, walkAnatomy, type Contract, type Part } from '../../scripts/contract-schema.js';

export interface AckedDecision {
  ids: string[];
  part: string;
  channel: string;
  scope: string; // 'base' | `axis:${prop}=${v1}|${v2}…`
  from: string;
  to: string;
  observed: string;
  expected: string;
  cause: string;
  ack: string;
}

export function applyDecisions(
  contract: Contract,
  decisions: AckedDecision[],
): { applied: string[]; skipped: string[] } {
  const applied: string[] = [];
  const skipped: string[] = [];
  const partByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  for (const d of decisions) {
    const target: Part | undefined = partByName.get(d.part);
    if (!target) {
      skipped.push(`${d.part}.${d.channel} [${d.scope}] → ${d.to}: part not in the promoted anatomy — NAMED skip`);
      continue;
    }
    if (d.scope === 'base') {
      target.tokens ??= {};
      target.tokens[d.channel] = d.to;
      for (const field of ['tokensByProp', 'literalsByProp'] as const) {
        const raw = target[field] as
          | Array<{ prop: string; map: Record<string, Record<string, unknown>> }>
          | { prop: string; map: Record<string, Record<string, unknown>> }
          | undefined;
        if (!raw) continue;
        const list = Array.isArray(raw) ? raw : [raw];
        for (const e of list) {
          for (const [value, m] of Object.entries(e.map)) {
            delete m[d.channel];
            if (Object.keys(m).length === 0) delete e.map[value];
          }
        }
        const kept = list.filter((e) => Object.keys(e.map).length > 0);
        if (kept.length === 0) delete target[field];
        else (target as Record<string, unknown>)[field] = Array.isArray(raw) ? kept : kept[0];
      }
      applied.push(`${d.part}.${d.channel} [base] → ${d.to}`);
      continue;
    }
    const m = /^axis:([\w-]+)=(.+)$/.exec(d.scope);
    if (!m) {
      skipped.push(`${d.part}.${d.channel}: unrecognized scope "${d.scope}" — NAMED skip`);
      continue;
    }
    const [, prop, valueList] = m;
    const values = valueList.split('|');
    const entries = tokensByPropEntries(target).map((e) => structuredClone(e));
    let entry = entries.find((e) => e.prop === prop && Object.values(e.map).some((mm) => d.channel in mm));
    if (!entry) entry = entries.find((e) => e.prop === prop && entries.filter((x) => x.prop === prop).length === 1);
    if (!entry) {
      entry = { prop, map: {} };
      entries.push(entry);
    }
    for (const v of values) (entry.map[v] ??= {})[d.channel] = d.to;
    target.tokensByProp = entries as never;
    applied.push(`${d.part}.${d.channel} [${d.scope}] → ${d.to}`);
  }
  return { applied, skipped };
}
