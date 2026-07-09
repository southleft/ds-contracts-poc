import { useRef, useState } from 'react';
import { assistNameTokens, type FetchLike } from '../engine/assist';
import { applyRenameRow, planRenames, type RenamePlanRow } from '../engine/mint-rename';
import { baseTokens, type MintedTokenLayer } from '../engine/token-source';

/**
 * The assist rename flow, rendered inside the minted-tokens receipts group.
 * Every suggestion is labeled ai-proposed; Apply is deterministic (the leaf's
 * value moves in the token layer, the ref rewrites in the contract text) and
 * the editor's validation referees the result — a bad name refuses by name.
 * Worker limit/budget messages (429/503) render VERBATIM.
 */

interface RowState {
  plan: RenamePlanRow;
  applied: boolean;
  error: string | null;
  notes: string[];
}

export function MintAssist({
  minted,
  component,
  text,
  onApplyText,
  fetchImpl,
}: {
  minted: MintedTokenLayer;
  component: string;
  /** The CURRENT contract text — rewrites always start from what's on screen. */
  text: string;
  onApplyText: (next: string) => void;
  /** Injectable transport (tests); window.__ASSIST_FETCH__ also works. */
  fetchImpl?: FetchLike;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowState[] | null>(null);
  // Minted paths still live (applied ones leave the set) — group applies and
  // late rows referee against the current layer, not the snapshot.
  const mintedPaths = useRef<Set<string>>(new Set());

  const suggest = async () => {
    setBusy(true);
    setError(null);
    setRows(null);
    try {
      const result = await assistNameTokens(
        {
          component,
          entries: minted.entries.map((e) => ({
            ref: e.ref,
            value: e.value,
            usageSites: e.usageSites,
          })),
          // The BASE source's paths — the vocabulary renames should follow;
          // the minted imported.* layer itself is excluded on purpose.
          existingTokenPaths: [...baseTokens().inventory].sort().slice(0, 3000),
        },
        fetchImpl,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      mintedPaths.current = new Set(
        minted.entries.map((e) => e.ref.replace(/^\{/, '').replace(/\}$/, '')),
      );
      const plans = planRenames(result.data.renames, text, mintedPaths.current);
      if (plans.length === 0) {
        setError('assist returned no renames — nothing to propose');
        return;
      }
      setRows(plans.map((plan) => ({ plan, applied: false, error: null, notes: [] })));
    } finally {
      setBusy(false);
    }
  };

  /** Apply one row against `fromText`; returns the rewritten text (or null). */
  const applyOne = (
    current: RowState[],
    index: number,
    fromText: string,
  ): { next: RowState[]; text: string | null } => {
    const row = current[index];
    if (row.applied) return { next: current, text: null };
    const outcome = applyRenameRow(
      row.plan,
      current.map((r) => r.plan),
      fromText,
      mintedPaths.current,
    );
    if (!outcome.ok) {
      const next = current.map((r, i) => (i === index ? { ...r, error: outcome.error ?? 'refused' } : r));
      return { next, text: null };
    }
    for (const p of outcome.appliedFrom) mintedPaths.current.delete(p);
    const covered = new Set(outcome.appliedFrom);
    const next = current.map((r) =>
      covered.has(r.plan.from) ? { ...r, applied: true, error: null, notes: outcome.notes } : r,
    );
    return { next, text: outcome.text };
  };

  const handleApply = (index: number) => {
    if (!rows) return;
    const { next, text: rewritten } = applyOne(rows, index, text);
    setRows(next);
    if (rewritten !== null) onApplyText(rewritten);
  };

  const handleApplyAll = () => {
    if (!rows) return;
    let current = rows;
    let currentText = text;
    for (let i = 0; i < current.length; i++) {
      if (current[i].applied || current[i].plan.refused) continue;
      const { next, text: rewritten } = applyOne(current, i, currentText);
      current = next;
      if (rewritten !== null) currentText = rewritten;
    }
    setRows(current);
    if (currentText !== text) onApplyText(currentText);
  };

  const applicable = rows?.filter((r) => !r.applied && !r.plan.refused && !r.error) ?? [];

  return (
    <div className="mint-assist">
      <div className="mint-assist__bar">
        <button type="button" className="btn--small" disabled={busy} onClick={() => void suggest()}>
          {busy ? 'Asking the assist Worker…' : 'Suggest semantic names (AI)'}
        </button>
        {rows && applicable.length > 0 ? (
          <button type="button" className="btn--small" onClick={handleApplyAll}>
            Apply all ({applicable.length})
          </button>
        ) : null}
      </div>
      <p className="hint mint-assist__hint">
        Shared assist Worker (server-held key, daily caps) — every suggestion is ai-proposed;
        applying one rewrites the ref and moves the value, and the editor referees the result.
      </p>
      {error ? <div className="notice notice--error mint-assist__error">{error}</div> : null}
      {rows
        ? rows.map((row, i) => (
            <div key={row.plan.from} className="mint-assist__row">
              <div className="mint-assist__line">
                <span className="mint-assist__tag" aria-label="AI-proposed suggestion">
                  ai-proposed
                </span>
                <code className="mint-assist__from">{`{${row.plan.from}}`}</code>
                <span aria-hidden> → </span>
                <code className="mint-assist__to">{`{${row.plan.to}}`}</code>
                {row.applied ? (
                  <span className="mint-assist__applied">applied ✓</span>
                ) : row.plan.refused ? null : (
                  <button type="button" className="btn--small" onClick={() => handleApply(i)}>
                    Apply{row.plan.kind === 'grouped' ? ' (group)' : ''}
                  </button>
                )}
              </div>
              <div className="mint-assist__rationale">{row.plan.rationale}</div>
              {row.plan.refused ? (
                <div className="mint-assist__refusal">refused — {row.plan.refused}</div>
              ) : null}
              {row.error ? <div className="mint-assist__refusal">refused — {row.error}</div> : null}
              {row.notes.map((n, j) => (
                <div key={j} className="mint-assist__note">
                  {n}
                </div>
              ))}
            </div>
          ))
        : null}
    </div>
  );
}
