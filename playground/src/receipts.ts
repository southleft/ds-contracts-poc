/**
 * Receipts — the degradation ladder as a first-class UI object. Every entry
 * is VERBATIM from the engine (MapReport degradations, proposal notes,
 * unbound values with nearest-token candidates, skipped components).
 * Receipts are the feature, not warnings: what the engine refused to invent.
 */
export interface ReceiptEntry {
  /** Named code (e.g. "variable-unresolved") when the engine names one. */
  code?: string;
  /** Where (nodePath / component name), when the engine says. */
  label?: string;
  /** The engine's message, verbatim. */
  message: string;
  /** Nearest-token candidates, verbatim. */
  suggestions?: string[];
  /** Raw technical detail (e.g. a validator's own text) — rendered as an
   *  expandable secondary line, NEVER as the headline. */
  detail?: string;
}

export interface ReceiptGroup {
  title: string;
  kind: 'degradation' | 'note' | 'unbound' | 'skipped' | 'minted';
  entries: ReceiptEntry[];
  /** Display-state groups the UI ADDS after the fact (workspace-restore
   *  provenance, stub re-referee) stay out of the badge count — the count is
   *  the import's own record, so a restored entry shows the same N its
   *  import did. The group still renders, title carrying its own (n). */
  uncounted?: boolean;
}

export interface Receipts {
  /** Provenance line: what produced these receipts. */
  source: string;
  groups: ReceiptGroup[];
}

export const receiptCount = (r: Receipts): number =>
  r.groups.reduce((n, g) => n + (g.uncounted ? 0 : g.entries.length), 0);
