/**
 * SYNC LEDGER GATE — `npm run sync:ledger:check`. Offline, no network.
 *
 * Refuses, by name:
 *   1. a committed sync/ledger.json that fails schema validation or whose
 *      bytes are not the deterministic serialization (hand-edits that
 *      reorder records or keys would make every future diff noise);
 *   2. ANY record that disagrees with the receipt it cites
 *      (fingerprint/fileKey/nodeId — the receipts under
 *      parity/receipts/console-loop are READ-ONLY evidence here).
 *
 *      THE PROVENANCE HOLE THIS CLOSES (2026-08-09). This check used to run
 *      only where `provenance === 'seeded-from-receipts'`. But the repair for
 *      a stale row is `sync record --from-receipt <receipt>`, and that verb
 *      re-labels the row `sync-record` — so the one command that fixes a
 *      disagreement ALSO removes the row from the check that found it. All 128
 *      committed records cite a receipt, so the laundered row would have kept
 *      citing evidence nothing compared it against, and the next receipt to
 *      move would go unnoticed. Measured by doing it: repairing altitude.badge
 *      dropped it out of the checked set. The citation, not the provenance
 *      label, is what makes a row checkable;
 *   3. a record whose contractPath no longer exists (a deleted contract must
 *      delete or re-point its ledger record, never rot silently);
 *   4. a drift table over the committed fixture that stops classifying all
 *      five statuses — the gate-shaped offline variant of `sync observe`
 *      (the live variant needs FIGMA_TOKEN and runs by hand:
 *      `npm run sync:observe`).
 *
 * NOT checked on purpose: current contract hashes vs ledger hashes — a
 * contract editing ahead of its last sync is code-ahead DRIFT (observe's
 * verdict), not ledger corruption, and a gate that failed CI on every
 * contract edit would be deleted within a week.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { contractHashOf, driftReport, parseLedger, recordKey, serializeLedger } from './ledger.js';
import { observationsFromFixture, type ObservationFixture } from './observe.js';

const ROOT = process.cwd();
const failures: string[] = [];
const fail = (msg: string): void => {
  failures.push(msg);
};

// 1. Schema + deterministic bytes -------------------------------------------
const ledgerPath = path.join(ROOT, 'sync', 'ledger.json');
const bytes = readFileSync(ledgerPath, 'utf8');
const ledger = parseLedger(bytes); // throws by name on schema violations
if (serializeLedger(ledger) !== bytes) {
  fail(
    'sync/ledger.json is not its own deterministic serialization — regenerate via sync/cli.ts (seed/record/observe --update), never hand-order',
  );
}

// 2. Every receipt-citing record agrees with the receipt it cites ------------
let cited = 0;
for (const r of ledger.records) {
  const citedPath = r.note?.match(/^receipt (.+)$/)?.[1];
  if (!citedPath) {
    // A row that cites nothing is only a failure when its provenance CLAIMS a
    // receipt; rows recorded from a live write may legitimately carry no note.
    if (r.provenance === 'seeded-from-receipts')
      fail(`${recordKey(r)}: seeded-from-receipts but the note cites no receipt path`);
    continue;
  }
  cited++;
  const receiptPath = path.join(ROOT, citedPath);
  if (!existsSync(receiptPath)) {
    fail(`${recordKey(r)}: cited receipt ${citedPath} is not on disk`);
    continue;
  }
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as {
    fileKey?: string;
    generate?: { nodeId?: string };
    fingerprint?: { v6?: string };
  };
  if (receipt.fingerprint?.v6 !== r.canvasFingerprint)
    fail(`${recordKey(r)}: canvasFingerprint ${r.canvasFingerprint} ≠ receipt ${citedPath} v6 ${receipt.fingerprint?.v6}`);
  if (receipt.fileKey !== r.fileKey)
    fail(`${recordKey(r)}: fileKey ${r.fileKey} ≠ receipt ${citedPath} fileKey ${receipt.fileKey}`);
  if (receipt.generate?.nodeId !== r.setNodeId)
    fail(`${recordKey(r)}: setNodeId ${r.setNodeId} ≠ receipt ${citedPath} nodeId ${receipt.generate?.nodeId}`);
}

// 3. Contract paths resolve --------------------------------------------------
for (const r of ledger.records) {
  if (r.contractPath && !existsSync(path.join(ROOT, r.contractPath)))
    fail(`${recordKey(r)}: contractPath ${r.contractPath} is not on disk`);
}

// 4. The offline drift table over the committed fixture ----------------------
const fixture = JSON.parse(
  readFileSync(path.join(ROOT, 'sync', 'fixtures', 'canvas.rest.fixture.json'), 'utf8'),
) as ObservationFixture;
const fixtureLedger = parseLedger(
  readFileSync(path.join(ROOT, 'sync', 'fixtures', 'ledger.fixture.json'), 'utf8'),
);
const hashes = new Map<string, string | null>();
for (const r of fixtureLedger.records) {
  const abs = r.contractPath ? path.join(ROOT, r.contractPath) : null;
  hashes.set(
    recordKey(r),
    abs && existsSync(abs)
      ? contractHashOf(JSON.parse(readFileSync(abs, 'utf8')) as Record<string, unknown>)
      : null,
  );
}
const report = driftReport(fixtureLedger, hashes, observationsFromFixture(fixture));
const expected: Record<string, string> = {
  'fixture.alpha': 'in-sync',
  'fixture.beta': 'code-ahead',
  'fixture.gamma': 'canvas-ahead',
  'fixture.delta': 'conflict',
};
for (const [id, want] of Object.entries(expected)) {
  const row = report.rows.find((r) => r.contractId === id);
  if (!row) fail(`fixture drift table lost the row for ${id}`);
  else if (row.status !== want)
    fail(`fixture drift table: ${id} classified ${row.status}, expected ${want}`);
}
if (report.untracked.length !== 1 || report.untracked[0].setName !== 'Epsilon')
  fail(
    `fixture drift table: expected exactly one untracked set (Epsilon), got [${report.untracked.map((u) => u.setName).join(', ')}]`,
  );
if (report.clean) fail('fixture drift table reported clean over a fixture built to drift');

// ---------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`✘ sync-ledger-check: ${failures.length} failure(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `sync-ledger-check: ${ledger.records.length} record(s) ok (${cited} receipt-citing record(s) verified against the receipts they cite), ` +
    'bytes deterministic, contract paths resolve; offline fixture drift table classifies ' +
    'in-sync / code-ahead / canvas-ahead / conflict / untracked exactly.',
);
