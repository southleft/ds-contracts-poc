/**
 * SYNC LEDGER I/O — the node-bound half (sync/ledger.ts stays pure/browser-
 * safe). Load refuses malformed bytes by name; save always writes the
 * deterministic serialization.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { emptyLedger, parseLedger, renderPendingMd, serializeLedger, type SyncLedger } from './ledger.js';

export const DEFAULT_LEDGER_PATH = path.join('sync', 'ledger.json');
export const PENDING_MD_NAME = 'PENDING.md';

/** sync/PENDING.md lives next to the ledger it is rendered from. */
export const pendingPathFor = (ledgerPath: string): string =>
  path.join(path.dirname(ledgerPath), PENDING_MD_NAME);

/** Write the generated pending-decisions page for this ledger (byte-stable —
 *  a pure render of the ledger; sync:ledger:check compares the two). */
export function savePendingMd(ledgerPath: string, ledger: SyncLedger): string {
  const p = pendingPathFor(ledgerPath);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, renderPendingMd(ledger));
  return p;
}

export function loadLedger(filePath: string): SyncLedger {
  return parseLedger(readFileSync(filePath, 'utf8'));
}

/** Load, or start empty when the file does not exist yet (a writer creating
 *  the first record). Malformed EXISTING bytes still refuse — an unreadable
 *  ledger must never be silently replaced. */
export function loadOrInitLedger(filePath: string): SyncLedger {
  return existsSync(filePath) ? loadLedger(filePath) : emptyLedger();
}

export function saveLedger(filePath: string, ledger: SyncLedger): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, serializeLedger(ledger));
}
