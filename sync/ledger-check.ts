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
 *      `npm run sync:observe`);
 *   5. any observation baseline recorded under a dump grammar other than the
 *      one the mapper speaks now (extract/figma/rest/map.ts
 *      REST_DUMP_VERSION). Such a baseline is incomparable — the scheduled
 *      spine names it and ignores it — so the ledger is carrying evidence
 *      nothing can re-measure. The repair is a live re-baseline
 *      (`npm run sync:observe -- --update`, FIGMA_TOKEN), in the SAME change
 *      that moved the grammar. Measured 2026-08-23: the 1.5 → 1.31 move
 *      shipped without one and six scheduled runs reported 87 untouched sets
 *      as designer edits. The same rule covers a PENDING decision's
 *      `basedOn.dumpVersion`: a decision whose canvas facts were measured
 *      under a grammar the mapper no longer speaks reads as STALE on the
 *      cron (every pending row red again) — re-observe and re-decide in the
 *      change that moves the grammar;
 *   6. a committed sync/PENDING.md that is not the byte-exact render of the
 *      committed ledger (`npm run sync -- pending`). PENDING.md is the ONE
 *      place a human reads the pending Figma writes; a page that can drift
 *      from the ledger it claims to summarize is worse than none.
 *
 * NOT checked on purpose: current contract hashes vs ledger hashes — a
 * contract editing ahead of its last sync is code-ahead DRIFT (observe's
 * verdict), not ledger corruption, and a gate that failed CI on every
 * contract edit would be deleted within a week.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  contractHashOf,
  driftReport,
  parseLedger,
  PENDING_KINDS,
  recordKey,
  renderPendingMd,
  serializeLedger,
} from './ledger.js';
import { pendingPathFor } from './ledger-io.js';
import { observationsFromFixture, type ObservationFixture } from './observe.js';
import { REST_DUMP_VERSION } from '../extract/figma/rest/map.js';

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

// 3b. Baselines speak the mapper's grammar ------------------------------------
let baselines = 0;
for (const r of ledger.records) {
  if (r.observed === null) continue;
  baselines++;
  if (r.observed.dumpVersion !== REST_DUMP_VERSION)
    fail(
      `${recordKey(r)}: observation baseline ${r.observed.dumpFingerprint} was recorded under dump grammar ` +
        `${r.observed.dumpVersion ?? '(untagged)'}; the mapper speaks ${REST_DUMP_VERSION} — incomparable. ` +
        'Re-baseline in this change: `npm run sync:observe -- --update` (live, FIGMA_TOKEN)',
    );
}
let pendingDecisions = 0;
let adoptDecisions = 0;
for (const r of ledger.records) {
  if (!r.decision) continue;
  if (r.decision.kind === 'adopt') {
    adoptDecisions++;
    continue;
  }
  pendingDecisions++;
  if (r.decision.basedOn.dumpVersion !== REST_DUMP_VERSION)
    fail(
      `${recordKey(r)}: decision ${r.decision.kind} was taken against dump grammar ${r.decision.basedOn.dumpVersion ?? '(none)'}; ` +
        `the mapper speaks ${REST_DUMP_VERSION} — the decision would read STALE on the cron. Re-decide in this change: ` +
        `\`npm run sync:observe -- --decide ${r.contractId} --kind ${r.decision.kind} --note … --command …\` (live, FIGMA_TOKEN)`,
    );
}

// 3c. sync/PENDING.md is the byte-exact render of this ledger ----------------
const pendingPath = pendingPathFor(ledgerPath);
const wantPending = renderPendingMd(ledger);
if (!existsSync(pendingPath)) fail(`${path.relative(ROOT, pendingPath)} is missing — generate it: \`npm run sync -- pending\``);
else if (readFileSync(pendingPath, 'utf8') !== wantPending)
  fail(
    `${path.relative(ROOT, pendingPath)} is not the current render of sync/ledger.json (${pendingDecisions} pending, ${adoptDecisions} adopted) — ` +
      'regenerate it: `npm run sync -- pending` (never hand-edit)',
  );

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
// The fixture carries no decisions: its three drifted rows + the untracked
// set are exactly what must red a run.
if (report.undecided !== 4)
  fail(`fixture drift table must count 4 undecided (beta, gamma, delta + untracked Epsilon), got ${report.undecided}`);

// ---------------------------------------------------------------------------
if (failures.length > 0) {
  console.error(`✘ sync-ledger-check: ${failures.length} failure(s)`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  `sync-ledger-check: ${ledger.records.length} record(s) ok (${cited} receipt-citing record(s) verified against the receipts they cite), ` +
    `bytes deterministic, contract paths resolve, ${baselines} baseline(s) speak dump grammar ${REST_DUMP_VERSION}, ` +
    `${adoptDecisions} adopt + ${pendingDecisions} pending decision(s) (${PENDING_KINDS.join('|')}) and sync/PENDING.md is their byte-exact render; ` +
    'offline fixture drift table classifies in-sync / code-ahead / canvas-ahead / conflict / untracked exactly (4 undecided).',
);
