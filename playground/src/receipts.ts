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
}

export interface ReceiptGroup {
  title: string;
  kind: 'degradation' | 'note' | 'unbound' | 'skipped' | 'minted';
  entries: ReceiptEntry[];
}

export interface Receipts {
  /** Provenance line: what produced these receipts. */
  source: string;
  groups: ReceiptGroup[];
}

export const receiptCount = (r: Receipts): number =>
  r.groups.reduce((n, g) => n + g.entries.length, 0);
