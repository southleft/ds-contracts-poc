import type { ReactNode } from 'react';
import type { Receipts } from '../receipts';
import { receiptCount } from '../receipts';

/**
 * The receipts panel — degradations, notes, unbound values, and skips,
 * VERBATIM from the engine. Styled as first-class output, not warnings:
 * this is the record of everything the engine refused to invent.
 *
 * `mintedExtras` renders directly under the minted-provisional-tokens group
 * (the assist rename flow lives there — next to the names it proposes for).
 */
export function ReceiptsPanel({
  receipts,
  mintedExtras,
}: {
  receipts: Receipts | null;
  mintedExtras?: ReactNode;
}) {
  return (
    <section className="receipts" aria-label="Receipts">
      <div className="receipts__head">
        <span className="pane__title">Receipts</span>
        {receipts ? (
          <span className="receipts__source">
            {receipts.source} — {receiptCount(receipts)} entr{receiptCount(receipts) === 1 ? 'y' : 'ies'}
          </span>
        ) : null}
      </div>
      {receipts ? (
        <p className="receipts__sub">
          What the engine reported instead of guessing — every gap, note, and raw value from this
          import, verbatim.
        </p>
      ) : null}
      {!receipts ? (
        <p className="receipts__empty">
          Import from Figma or propose from code and every degradation, note, and unbound value
          lands here, named.
        </p>
      ) : receipts.groups.length === 0 ? (
        <p className="receipts__empty">Clean pass — no degradations, no unbound values.</p>
      ) : (
        receipts.groups.map((group) => (
          <div key={group.title} className="receipts__group">
            <div className="receipts__group-title">
              {group.title} ({group.entries.length})
            </div>
            {group.entries.map((entry, i) => (
              <div key={i} className={`receipts__entry receipts__entry--${group.kind}`}>
                {entry.code ? <span className="receipts__code">[{entry.code}] </span> : null}
                {entry.label ? <span className="receipts__label">{entry.label} — </span> : null}
                {entry.message}
                {entry.suggestions && entry.suggestions.length > 0 ? (
                  <div className="receipts__suggestions">
                    nearest tokens: {entry.suggestions.join(', ')}
                  </div>
                ) : null}
              </div>
            ))}
            {group.kind === 'minted' ? mintedExtras : null}
          </div>
        ))
      )}
    </section>
  );
}
