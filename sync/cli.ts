/**
 * SYNC LEDGER CLI — `npm run sync -- <verb>`.
 *
 *   record   --from-receipt <console-loop-receipt.json> [--ledger <path>]
 *   record   --contract <file> --file-key K --node-id N --fingerprint v6:N
 *            [--version-id V] [--note …] [--ledger <path>]
 *       Record a completed code→canvas write (the console-loop/genesis emit
 *       paths call this after a generation receipt lands). Enforces the
 *       echo-loop invariant: no v6 fingerprint, no record.
 *
 *   seed     [--ledger <path>]
 *       Populate the ledger from the committed console-loop receipts
 *       (first-party + every foreign corpus). Receipts are READ-ONLY here;
 *       records are marked provenance "seeded-from-receipts".
 *
 *   observe  [--fixture <fixture.json>] [--file-key K] [--update] [--json]
 *            [--repin id[,id…]] [--adopt id[,id…] [--note text]] [--ledger <path>]
 *       THE DRIFT ARITHMETIC. Reads the current canvas state headlessly —
 *       from a committed ObservationFixture (offline, gate-shaped) or live
 *       over the Figma REST API (FIGMA_TOKEN; per-set stamp via
 *       plugin_data=shared + file version + dump-v1 fingerprint) — plus the
 *       current contract hashes, and classifies every ledger record:
 *       in-sync | code-ahead | canvas-ahead | conflict | untracked.
 *       Exit gate-style: 0 clean, 1 drift, 2 usage/config error.
 *       --update records observation baselines for in-sync rows (and adopts
 *       a post-publish restamp, clearing pendingApply — noted loudly). A
 *       baseline recorded under an older dump grammar (ledger.ts
 *       observed.dumpVersion ≠ the mapper's REST_DUMP_VERSION) is
 *       incomparable: --update re-records it where the row is in-sync and
 *       DROPS it, loudly and by name, where it is not (it described nothing
 *       the current instrument can re-measure).
 *       --repin id[,id…] (implies --update): the contract bytes moved by a
 *       bookkeeping change (a schema codemod, an anchor re-point) and the
 *       canvas half is PROVABLY unchanged — the observed stamp equals the
 *       ledger's — so re-pin contractHash to the current bytes without
 *       claiming a write. REFUSES by name for any row whose stamp differs,
 *       is absent, or is incomparable: a re-pin over a moved canvas would be
 *       the echo-loop false negative. Measured 2026-08-23: schema 17 moved
 *       104 contract hashes while 64 canvases carried the exact ledger stamp.
 *       --adopt id[,id…] (implies --update): take the CANVAS as the truth for
 *       these rows — record the current contract hash + the observed stamp +
 *       a fresh baseline, direction canvas→code. This is the after-merge
 *       step of a spine PR, and the record for a canvas write nobody ledgered
 *       (a plugin apply, a console-loop rebuild whose receipt never reached
 *       `sync record`). Explicit ids only, never "all"; --note is recorded
 *       as the row's DECISION (kind adopt, with --evidence lines).
 *       --decide <id> --kind pending-reapply|pending-restamp|pending-reconcile
 *            --note <why> --command <exact command> [--evidence <line>]…
 *       Record a HUMAN DECISION on a drifted row that automation cannot
 *       resolve (a Figma write to a non-scratch file; a choice between two
 *       truths). The row stays drifted, but the scheduled spine stops
 *       counting it as undecided (WARN, not red) and lists it in
 *       sync/PENDING.md with the command. The decision is bound to the
 *       facts observed now (contract hash, stamp, dump fingerprint) — if any
 *       of them moves again the decision is STALE and the row is undecided
 *       again. Refuses on an in-sync row (nothing to decide) and on kind
 *       adopt (that is --adopt, which changes the record).
 *       Exit is gate-style on UNDECIDED rows: 0 when every drifted row
 *       carries a fresh decision (decided-pending rows print as WARN),
 *       1 when a row needs a human decision that is not yet recorded (or
 *       an untracked set exists), 2 usage/config error.
 *
 *   pending  [--ledger <path>]
 *       Regenerate sync/PENDING.md (next to the ledger) from the ledger —
 *       offline, byte-stable; sync:ledger:check refuses a stale one.
 *
 *   pull     [--fixture <fixture.json>] [--file-key K] [--only id[,id…]]
 *            [--out sync/out] [--run-id id] [--ledger <path>]
 *       THE CANVAS→CODE HALF OF THE DRIFT SPINE (step 2). For every
 *       canvas-ahead (and conflict) record: headless REST dump of the set
 *       (the same mapper observe rides), the design→contract proposer in
 *       reviewable-inversion mode against the current contract as base, and
 *       a per-component drift bundle — proposed contract + unified diff +
 *       per-property classification (matched | canvas-absent | mismatch) +
 *       the observation an adoption would record. Files land under
 *       sync/out/<runId>/ and are NEVER applied to contracts/. Exit is
 *       gate-style like observe: 0 clean, 1 drift(s) pulled, 2 usage.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  baselineComparableWith,
  contractHashOf,
  decisionBasedOn,
  decisionSummary,
  driftReport,
  makeDecision,
  PENDING_KINDS,
  recordCodeToCanvasSync,
  recordKey,
  type DecisionKind,
  type DriftRow,
  type LedgerRecord,
  type ObservationBaseline,
  type SetObservation,
  type SyncLedger,
} from './ledger.js';
import {
  DEFAULT_LEDGER_PATH,
  loadLedger,
  loadOrInitLedger,
  pendingPathFor,
  saveLedger,
  savePendingMd,
} from './ledger-io.js';
import {
  fetchNodesResponses,
  fetchObservation,
  observationsFromFixture,
  observationsFromRestNodes,
  type ObservationFixture,
} from './observe.js';
import { fetchVariables } from '../extract/figma/rest/fetch.js';
import type { RestNodesResponse, RestVariablesResponse } from '../extract/figma/rest/map.js';
import { pullRecord } from './pull.js';

const ROOT = process.cwd();

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
const has = (args: string[], name: string): boolean => args.includes(`--${name}`);
/** Every value of a repeatable flag (`--evidence a --evidence b`). */
function flags(args: string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) if (args[i] === `--${name}` && args[i + 1] !== undefined) out.push(args[i + 1]);
  return out;
}

function usage(msg?: string): never {
  if (msg) console.error(`✘ ${msg}`);
  console.error('Usage: sync/cli.ts record|seed|observe|pending|pull — see the header of sync/cli.ts');
  process.exit(2);
}

function readJson(p: string): Record<string, unknown> {
  return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

interface ConsoleLoopReceipt {
  status?: string;
  component?: string;
  contract?: string;
  fileKey?: string;
  recordedAt?: string;
  generate?: { nodeId?: string };
  fingerprint?: { v6?: string };
}

function recordFromReceipt(
  ledger: SyncLedger,
  receiptPath: string,
  provenance: 'sync-record' | 'seeded-from-receipts',
): { ledger: SyncLedger; contractId: string } | { ledger: SyncLedger; skipped: string } {
  const r = readJson(receiptPath) as ConsoleLoopReceipt;
  const rel = path.relative(ROOT, path.resolve(receiptPath));
  if (r.status !== 'completed')
    return { ledger, skipped: `${rel}: status ${JSON.stringify(r.status)} — only completed receipts seed` };
  const v6 = r.fingerprint?.v6;
  const nodeId = r.generate?.nodeId;
  if (!r.contract || !r.fileKey || !v6 || !nodeId)
    return { ledger, skipped: `${rel}: missing contract/fileKey/fingerprint.v6/generate.nodeId` };
  const contractAbs = path.resolve(ROOT, r.contract);
  if (!existsSync(contractAbs))
    return { ledger, skipped: `${rel}: contract ${r.contract} not on disk` };
  const contract = readJson(contractAbs);
  const contractId = String(contract.id ?? '');
  if (!contractId) return { ledger, skipped: `${rel}: contract ${r.contract} has no id` };
  return {
    ledger: recordCodeToCanvasSync(ledger, {
      contractId,
      contractPath: r.contract,
      contractHash: contractHashOf(contract),
      fileKey: r.fileKey,
      setNodeId: nodeId,
      canvasFingerprint: v6,
      at: r.recordedAt ?? new Date().toISOString(),
      provenance,
      note: `receipt ${rel}`,
    }),
    contractId,
  };
}

function recordCommand(args: string[]): number {
  const ledgerPath = flag(args, 'ledger') ?? DEFAULT_LEDGER_PATH;
  let ledger = loadOrInitLedger(ledgerPath);
  const receipt = flag(args, 'from-receipt');
  if (receipt) {
    const out = recordFromReceipt(ledger, receipt, 'sync-record');
    if ('skipped' in out) usage(`record --from-receipt refused: ${out.skipped}`);
    saveLedger(ledgerPath, out.ledger);
    console.log(`✔ recorded code→canvas sync for ${out.contractId} → ${ledgerPath}`);
    return 0;
  }
  const contractPath = flag(args, 'contract');
  const fileKey = flag(args, 'file-key');
  const nodeId = flag(args, 'node-id');
  const fingerprint = flag(args, 'fingerprint');
  if (!contractPath || !fileKey || !nodeId || !fingerprint)
    usage('record needs --from-receipt <path>, or --contract --file-key --node-id --fingerprint');
  const contract = readJson(path.resolve(ROOT, contractPath));
  const contractId = String(contract.id ?? '');
  if (!contractId) usage(`${contractPath} has no "id"`);
  ledger = recordCodeToCanvasSync(ledger, {
    contractId,
    contractPath: path.relative(ROOT, path.resolve(ROOT, contractPath)),
    contractHash: contractHashOf(contract),
    fileKey,
    setNodeId: nodeId,
    canvasFingerprint: fingerprint,
    versionId: flag(args, 'version-id') ?? null,
    at: new Date().toISOString(),
    provenance: 'sync-record',
    ...(flag(args, 'note') ? { note: flag(args, 'note') } : {}),
  });
  saveLedger(ledgerPath, ledger);
  console.log(`✔ recorded code→canvas sync for ${contractId} → ${ledgerPath}`);
  return 0;
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

/** The committed generation evidence (READ-ONLY): first-party + foreign. */
export const RECEIPT_DIRS = [
  'parity/receipts/console-loop/components',
  'parity/receipts/console-loop/mui/components',
  'parity/receipts/console-loop/tailwind/components',
  'parity/receipts/console-loop/altitude/components',
  'parity/receipts/console-loop/astryx/components',
  'parity/receipts/console-loop/carbon/components',
  'parity/receipts/console-loop/polaris/components',
];

function seedCommand(args: string[]): number {
  const ledgerPath = flag(args, 'ledger') ?? DEFAULT_LEDGER_PATH;
  let ledger = loadOrInitLedger(ledgerPath);
  let seeded = 0;
  const skips: string[] = [];
  for (const dir of RECEIPT_DIRS) {
    const abs = path.join(ROOT, dir);
    if (!existsSync(abs)) {
      skips.push(`${dir}: directory absent`);
      continue;
    }
    for (const f of readdirSync(abs).filter((f) => f.endsWith('.json')).sort()) {
      const out = recordFromReceipt(ledger, path.join(abs, f), 'seeded-from-receipts');
      if ('skipped' in out) skips.push(out.skipped);
      else {
        ledger = out.ledger;
        seeded++;
      }
    }
  }
  saveLedger(ledgerPath, ledger);
  console.log(`✔ seeded ${seeded} record(s) from committed receipts → ${ledgerPath}`);
  for (const s of skips) console.log(`  skipped ${s}`);
  return 0;
}

// ---------------------------------------------------------------------------
// observe
// ---------------------------------------------------------------------------

function currentContractHashes(records: readonly LedgerRecord[]): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const r of records) {
    let hash: string | null = null;
    if (r.contractPath) {
      const abs = path.resolve(ROOT, r.contractPath);
      if (existsSync(abs)) {
        try {
          hash = contractHashOf(readJson(abs));
        } catch {
          hash = null; // unreadable = unverifiable, classified by name downstream
        }
      }
    }
    out.set(recordKey(r), hash);
  }
  return out;
}

const STATUS_ORDER = ['conflict', 'canvas-ahead', 'code-ahead', 'untracked', 'in-sync'] as const;

function printTable(rows: DriftRow[], untracked: Array<{ setName: string; setNodeId: string; fileKey: string | null }>, verbose: boolean): void {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  if (untracked.length > 0) counts.set('untracked', untracked.length);
  for (const row of rows) {
    const mark = row.status === 'in-sync' ? '✔' : '✘';
    console.log(`${mark} ${row.status.padEnd(12)} ${row.contractId}`);
    if (verbose || row.status !== 'in-sync') for (const n of row.notes) console.log(`    ${n}`);
  }
  for (const u of untracked)
    console.log(`✘ ${'untracked'.padEnd(12)} ${u.setName} (${u.fileKey ?? '?'}#${u.setNodeId}) — observed set has no ledger record`);
  console.log(
    `\nsync observe: ${rows.length} tracked record(s) — ` +
      STATUS_ORDER.filter((s) => counts.has(s))
        .map((s) => `${counts.get(s)} ${s}`)
        .join(', ') || '0 records',
  );
}

async function observeCommand(args: string[]): Promise<number> {
  const ledgerPath = flag(args, 'ledger') ?? DEFAULT_LEDGER_PATH;
  if (!existsSync(ledgerPath)) usage(`no ledger at ${ledgerPath} — run \`sync seed\` first`);
  let ledger = loadLedger(ledgerPath);
  const fixturePath = flag(args, 'fixture');
  const fileKeyFilter = flag(args, 'file-key');
  const repinIds = flag(args, 'repin')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const adoptIds = flag(args, 'adopt')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const update = has(args, 'update') || repinIds.length > 0 || adoptIds.length > 0;
  if (has(args, 'repin') && repinIds.length === 0) usage('--repin needs id[,id…]');
  if (has(args, 'adopt') && adoptIds.length === 0) usage('--adopt needs id[,id…] (explicit, never "all")');
  const decideId = flag(args, 'decide');
  if (has(args, 'decide') && !decideId) usage('--decide needs <id>');
  if (decideId && update) usage('--decide is its own verb — not combined with --update/--repin/--adopt');
  const evidenceLines = flags(args, 'evidence');

  let observations: SetObservation[];
  let fileKeys: Set<string> | undefined;
  if (fixturePath) {
    const fixture = JSON.parse(readFileSync(path.resolve(ROOT, fixturePath), 'utf8')) as ObservationFixture;
    observations = observationsFromFixture(fixture);
    fileKeys = fixture.fileKey ? new Set([fixture.fileKey]) : undefined;
  } else {
    const token = process.env.FIGMA_TOKEN;
    if (!token)
      usage('live observe needs FIGMA_TOKEN (source .env) — or pass --fixture <file> for the offline path');
    const byFile = new Map<string, string[]>();
    for (const r of ledger.records) {
      if (!r.fileKey || !r.setNodeId) continue;
      if (fileKeyFilter && r.fileKey !== fileKeyFilter) continue;
      const ids = byFile.get(r.fileKey) ?? [];
      ids.push(r.setNodeId);
      byFile.set(r.fileKey, ids);
    }
    if (byFile.size === 0) usage(`no ledger records carry a fileKey${fileKeyFilter ? ` matching ${fileKeyFilter}` : ''}`);
    observations = [];
    for (const [fk, ids] of byFile) {
      const { observations: obs } = await fetchObservation(fk, ids, token);
      observations.push(...obs);
    }
    fileKeys = new Set(byFile.keys());
  }

  const scoped = fileKeys
    ? ledger.records.filter((r) => r.fileKey !== null && fileKeys!.has(r.fileKey))
    : ledger.records;
  const hashes = currentContractHashes(scoped);
  const report = driftReport(ledger, hashes, observations, fileKeys ? { fileKeys } : {});

  if (has(args, 'json')) console.log(JSON.stringify(report, null, 2));
  else printTable(report.rows, report.untracked, has(args, 'verbose'));

  // --decide: record a human decision on ONE drifted row, bound to the
  // facts observed right now. The record itself does not change.
  if (decideId) {
    const kind = flag(args, 'kind') as DecisionKind | undefined;
    const note = flag(args, 'note');
    const command = flag(args, 'command');
    if (!kind || !PENDING_KINDS.includes(kind))
      usage(`--decide needs --kind ${PENDING_KINDS.join('|')} (adopt is \`--adopt\`, which changes the record)`);
    if (!note) usage('--decide needs --note <why>');
    if (!command) usage(`--decide --kind ${kind} needs --command <the exact command, or the named human choice, that resolves it>`);
    const r = ledger.records.find((x) => x.contractId === decideId);
    if (!r) usage(`--decide ${decideId}: not a ledger record`);
    const row = report.rows.find((x) => x.key === recordKey(r));
    if (!row) usage(`--decide ${decideId}: the row is outside this observation's scope (file ${r.fileKey ?? '(none)'})`);
    if (row.status === 'in-sync') usage(`--decide ${decideId} REFUSED: the row is in-sync — there is nothing to decide`);
    const obs = r.setNodeId
      ? observations.find((o) => `${o.fileKey ?? '(no-file)'}#${o.setNodeId}` === `${r.fileKey ?? '(no-file)'}#${r.setNodeId}`)
      : undefined;
    const now = new Date().toISOString();
    const decision = makeDecision({
      kind,
      note,
      recordedAt: now,
      evidence: [
        `drift at decision time: ${row.status} (canvas evidence ${row.canvasEvidence}); contract hash ${hashes.get(recordKey(r)) ?? 'none'}; ` +
          `observed stamp ${obs?.stamp ?? 'none'}, dump ${obs?.dumpFingerprint ?? 'none'} (grammar ${obs?.dumpVersion ?? 'none'}), file version ${obs?.fileVersionId ?? 'none'}`,
        ...evidenceLines,
      ],
      basedOn: decisionBasedOn(hashes.get(recordKey(r)) ?? null, obs),
      command,
    });
    ledger = {
      ...ledger,
      records: ledger.records.map((x) => (x === r ? { ...x, decision } : x)),
    };
    saveLedger(ledgerPath, ledger);
    const pendingPath = savePendingMd(ledgerPath, ledger);
    console.log(`✔ --decide ${decideId}: ${kind} recorded (${note}) → ${ledgerPath}; ${pendingPath} regenerated`);
    console.log(`  resolve with: ${command}`);
    // Re-classify so the exit code reflects the decision just taken.
    const after = driftReport(ledger, hashes, observations, fileKeys ? { fileKeys } : {});
    return after.undecided === 0 ? 0 : 1;
  }

  if (update) {
    const byNode = new Map(observations.map((o) => [`${o.fileKey ?? '(no-file)'}#${o.setNodeId}`, o]));
    const now = new Date().toISOString();
    const baselineOf = (obs: SetObservation): ObservationBaseline => ({
      dumpFingerprint: obs.dumpFingerprint,
      dumpVersion: obs.dumpVersion,
      fileVersionId: obs.fileVersionId,
      observedAt: now,
    });
    const byId = new Map(ledger.records.map((r) => [r.contractId, r]));
    for (const id of [...repinIds, ...adoptIds])
      if (!byId.has(id)) usage(`--repin/--adopt: ${id} is not a ledger record`);
    const noteFlag = flag(args, 'note');

    // --repin: the code bytes moved by bookkeeping; the canvas provably did
    // not. Refuse anything short of an exact stamp match.
    let repinned = 0;
    for (const id of repinIds) {
      const r = byId.get(id)!;
      const obs = r.setNodeId ? byNode.get(`${r.fileKey ?? '(no-file)'}#${r.setNodeId}`) : undefined;
      const currentHash = hashes.get(recordKey(r)) ?? null;
      if (!obs) usage(`--repin ${id}: the set was not observed — nothing proves the canvas half`);
      if (currentHash === null) usage(`--repin ${id}: contract ${r.contractPath ?? '(none)'} is unreadable — no hash to pin`);
      if (obs.stamp === null || r.canvasFingerprint === null || obs.stamp !== r.canvasFingerprint)
        usage(
          `--repin ${id} REFUSED: canvas stamp ${obs.stamp ?? 'none'} ≠ ledger ${r.canvasFingerprint ?? 'none'} — ` +
            'the canvas half is not provably unchanged; use --adopt (canvas is the truth) or re-apply from code',
        );
      if (r.pendingApply) usage(`--repin ${id} REFUSED: a publish is pending apply — the canvas has not adopted this contract`);
      if (currentHash === r.contractHash) {
        console.log(`  = ${id}: contract hash already matches the ledger — nothing to re-pin`);
        continue;
      }
      repinned++;
      console.log(`  ↻ ${id}: contractHash re-pinned ${r.contractHash?.slice(0, 19) ?? 'null'}… → ${currentHash.slice(0, 19)}… (stamp ${obs.stamp} unchanged)`);
      byId.set(id, {
        ...r,
        contractHash: currentHash,
        lastSyncedVersionId: obs.fileVersionId,
        lastSyncedAt: now,
        observed: baselineOf(obs),
        provenance: 'observe',
      });
    }

    // --adopt: the canvas is the truth for this row.
    let adopted = 0;
    for (const id of adoptIds) {
      const r = byId.get(id)!;
      const obs = r.setNodeId ? byNode.get(`${r.fileKey ?? '(no-file)'}#${r.setNodeId}`) : undefined;
      const currentHash = hashes.get(recordKey(r)) ?? null;
      if (!obs) usage(`--adopt ${id}: the set was not observed — nothing to adopt`);
      if (currentHash === null) usage(`--adopt ${id}: contract ${r.contractPath ?? '(none)'} is unreadable — an adoption records the contract it lands on`);
      const v6 = obs.stamp !== null && /^v6:\d+$/.test(obs.stamp) ? obs.stamp : null;
      if (v6 === null)
        console.log(
          `  ⚠ ${id}: the set carries ${obs.stamp ?? 'no'} stamp (not a v6 value) — keeping the ledger's ${r.canvasFingerprint ?? 'null'}; ` +
            'the baseline is the canvas evidence for this row',
        );
      adopted++;
      const { pendingApply: _drop, decision: _prior, ...rest } = r;
      const why = `adopted from live observation ${now.slice(0, 10)}` + (noteFlag ? ` — ${noteFlag}` : '') + (r.note ? ` (prior: ${r.note})` : '');
      const rowBefore = report.rows.find((x) => x.key === recordKey(r));
      console.log(`  ✚ ${id}: adopted canvas stamp ${v6 ?? r.canvasFingerprint} + contract hash ${currentHash.slice(0, 19)}… (canvas→code)`);
      // The adoption IS the decision: recorded on the row, bound to the
      // facts adopted, so a later move re-opens the question.
      const decision = makeDecision({
        kind: 'adopt',
        note: noteFlag ?? `adopted from live observation ${now.slice(0, 10)}`,
        recordedAt: now,
        evidence: [
          `before adoption: ${rowBefore?.status ?? '?'} (canvas evidence ${rowBefore?.canvasEvidence ?? '?'}); ledger stamp ${r.canvasFingerprint ?? 'none'} → observed ${obs.stamp ?? 'none'}; ` +
            `ledger hash ${r.contractHash?.slice(0, 19) ?? 'none'}… → ${currentHash.slice(0, 19)}…; dump ${obs.dumpFingerprint} (grammar ${obs.dumpVersion}); file version ${obs.fileVersionId ?? 'none'}`,
          ...evidenceLines,
        ],
        basedOn: decisionBasedOn(currentHash, obs),
      });
      byId.set(id, {
        ...rest,
        contractHash: currentHash,
        canvasFingerprint: v6 ?? r.canvasFingerprint,
        lastSyncedVersionId: obs.fileVersionId,
        lastSyncedAt: now,
        direction: 'canvas→code',
        observed: baselineOf(obs),
        provenance: 'observe',
        note: why,
        decision,
      });
    }
    ledger = { ...ledger, records: [...byId.values()] };

    let updated = 0;
    let dropped = 0;
    const touched = new Set([...repinIds, ...adoptIds]);
    ledger = {
      ...ledger,
      records: ledger.records.map((r) => {
        if (touched.has(r.contractId)) return r;
        const obs = r.setNodeId ? byNode.get(`${r.fileKey ?? '(no-file)'}#${r.setNodeId}`) : undefined;
        if (!obs) return r;
        const row = report.rows.find((x) => x.key === recordKey(r));
        if (!row) return r;
        if (row.status === 'in-sync' && !r.pendingApply) {
          updated++;
          return { ...r, observed: baselineOf(obs) };
        }
        // A baseline the current grammar cannot re-measure on a row that is
        // NOT in-sync: it names nothing about today's canvas. Drop it, by
        // name, rather than carry evidence the instrument can no longer read.
        if (r.observed !== null && !baselineComparableWith(r.observed, obs)) {
          dropped++;
          console.log(
            `  ✂ ${r.contractId}: dropped baseline ${r.observed.dumpFingerprint} (dump grammar ${r.observed.dumpVersion ?? 'untagged'} → ${obs.dumpVersion}; row is ${row.status}, not re-baselined)`,
          );
          return { ...r, observed: null };
        }
        // A pendingApply record whose set now carries a DIFFERENT stamp than
        // the ledger recorded at publish time: the canvas was written after
        // the publish. Adopt loudly — the code-half hash comparison still
        // catches a wrong-contract apply on the next observation.
        if (r.pendingApply && obs.stamp !== null && obs.stamp !== r.canvasFingerprint) {
          updated++;
          console.log(
            `  ⚠ ${r.contractId}: canvas restamped after publish (${obs.stamp}) — clearing pendingApply and adopting the stamp`,
          );
          const { pendingApply: _drop, ...rest } = r;
          return {
            ...rest,
            canvasFingerprint: obs.stamp,
            observed: baselineOf(obs),
            provenance: 'observe' as const,
          };
        }
        return r;
      }),
    };
    saveLedger(ledgerPath, ledger);
    const pendingPath = savePendingMd(ledgerPath, ledger);
    console.log(
      `✔ --update: ${updated} observation baseline(s) recorded, ${repinned} re-pinned, ${adopted} adopted, ` +
        `${dropped} incomparable baseline(s) dropped → ${ledgerPath}; ${pendingPath} regenerated`,
    );
    // Exit on the ledger as it now stands.
    const after = driftReport(ledger, hashes, observations, fileKeys ? { fileKeys } : {});
    printDecisionLine(after.rows, after.untracked.length);
    return after.undecided === 0 ? 0 : 1;
  }

  printDecisionLine(report.rows, report.untracked.length);
  return report.undecided === 0 ? 0 : 1;
}

/** The one line the exit code is read from: what is decided, what is not. */
function printDecisionLine(rows: DriftRow[], untracked: number): void {
  const s = decisionSummary(rows);
  const pending = PENDING_KINDS.map((k) => `${s.pending[k]} ${k}`).join(', ');
  console.log(
    `decisions: ${s.adopted} adopted, pending ${pending}, ${s.stale} stale, ${s.undecided} undecided` +
      (untracked > 0 ? `, ${untracked} untracked` : '') +
      ` — exit ${s.undecided + untracked === 0 ? '0 (every drifted row carries a fresh decision)' : '1 (a row needs a human decision that is not yet recorded)'}`,
  );
}

// ---------------------------------------------------------------------------
// pending — regenerate sync/PENDING.md from the ledger (offline)
// ---------------------------------------------------------------------------

function pendingCommand(args: string[]): number {
  const ledgerPath = flag(args, 'ledger') ?? DEFAULT_LEDGER_PATH;
  if (!existsSync(ledgerPath)) usage(`no ledger at ${ledgerPath}`);
  const ledger = loadLedger(ledgerPath);
  const p = savePendingMd(ledgerPath, ledger);
  const n = ledger.records.filter((r) => r.decision && PENDING_KINDS.includes(r.decision.kind)).length;
  console.log(`✔ ${p} regenerated from ${ledgerPath} — ${n} pending decision(s)`);
  return 0;
}

// ---------------------------------------------------------------------------
// pull — the canvas→code half of the drift spine (sync/pull.ts does the work)
// ---------------------------------------------------------------------------

async function pullCommand(args: string[]): Promise<number> {
  const ledgerPath = flag(args, 'ledger') ?? DEFAULT_LEDGER_PATH;
  if (!existsSync(ledgerPath)) usage(`no ledger at ${ledgerPath} — run \`sync seed\` first`);
  const ledger = loadLedger(ledgerPath);
  const fixturePath = flag(args, 'fixture');
  const fileKeyFilter = flag(args, 'file-key');
  const only = flag(args, 'only')?.split(',').map((s) => s.trim()).filter(Boolean);
  const outRoot = path.resolve(ROOT, flag(args, 'out') ?? path.join('sync', 'out'));
  const runId =
    flag(args, 'run-id') ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = path.join(outRoot, runId);

  const responsesByFile = new Map<string, RestNodesResponse[]>();
  const versionByFile = new Map<string, string | null>();
  const variablesByFile = new Map<string, RestVariablesResponse | undefined>();
  let observations: SetObservation[] = [];
  let fileKeys: Set<string> | undefined;
  let token: string | undefined;
  if (fixturePath) {
    const fixture = JSON.parse(
      readFileSync(path.resolve(ROOT, fixturePath), 'utf8'),
    ) as ObservationFixture;
    observations = observationsFromFixture(fixture);
    responsesByFile.set(fixture.fileKey ?? '(no-file)', [fixture.response]);
    versionByFile.set(fixture.fileKey ?? '(no-file)', fixture.fileVersionId);
    fileKeys = fixture.fileKey ? new Set([fixture.fileKey]) : undefined;
  } else {
    token = process.env.FIGMA_TOKEN;
    if (!token)
      usage('live pull needs FIGMA_TOKEN (source .env) — or pass --fixture <file> for the offline path');
    const byFile = new Map<string, string[]>();
    for (const r of ledger.records) {
      if (!r.fileKey || !r.setNodeId) continue;
      if (fileKeyFilter && r.fileKey !== fileKeyFilter) continue;
      const ids = byFile.get(r.fileKey) ?? [];
      ids.push(r.setNodeId);
      byFile.set(r.fileKey, ids);
    }
    if (byFile.size === 0) usage(`no ledger records carry a fileKey${fileKeyFilter ? ` matching ${fileKeyFilter}` : ''}`);
    for (const [fk, ids] of byFile) {
      const { responses, fileVersionId } = await fetchNodesResponses(fk, ids, token);
      responsesByFile.set(fk, responses);
      versionByFile.set(fk, fileVersionId);
      for (const response of responses)
        observations.push(...observationsFromRestNodes(response, fk, fileVersionId));
    }
    fileKeys = new Set(byFile.keys());
  }

  const scoped = fileKeys
    ? ledger.records.filter((r) => r.fileKey !== null && fileKeys!.has(r.fileKey))
    : ledger.records;
  const hashes = currentContractHashes(scoped);
  const report = driftReport(ledger, hashes, observations, fileKeys ? { fileKeys } : {});
  const rows = only ? report.rows.filter((r) => only.includes(r.contractId)) : report.rows;
  const recordByKey = new Map(ledger.records.map((r) => [recordKey(r), r]));

  const canvasRows = rows.filter((r) => r.status === 'canvas-ahead' || r.status === 'conflict');
  const undecidedInScope = rows.filter((r) => r.undecided).length + (only ? 0 : report.untracked.length);
  if (canvasRows.length === 0) {
    console.log('sync pull: no canvas-ahead record in scope — nothing to pull');
    return undecidedInScope === 0 ? 0 : 1;
  }
  mkdirSync(runDir, { recursive: true });
  let pulled = 0;
  let refused = 0;
  for (const row of canvasRows) {
    const record = recordByKey.get(row.key)!;
    const fk = record.fileKey ?? '(no-file)';
    const response = (responsesByFile.get(fk) ?? []).find(
      (r) => record.setNodeId !== null && r.nodes?.[record.setNodeId],
    );
    if (!response) {
      console.log(`✘ ${record.contractId}: set node absent from every fetched nodes response — skipped`);
      refused++;
      continue;
    }
    if (token && !variablesByFile.has(fk) && record.fileKey) {
      variablesByFile.set(fk, await fetchVariables(record.fileKey, token).catch(() => undefined));
    }
    const outcome = pullRecord({
      record,
      row,
      response,
      fileVersionId: versionByFile.get(fk) ?? null,
      variables: variablesByFile.get(fk),
      root: ROOT,
      runDir,
    });
    if (outcome.status === 'pulled') {
      pulled++;
      const mm = outcome.findings.filter((f) => f.status === 'mismatch').length;
      console.log(
        `✔ pulled ${record.contractId} → ${path.relative(ROOT, outcome.dir)}/ ` +
          `(${outcome.findings.length} findings, ${mm} mismatch, ${outcome.minted?.count ?? 0} minted)`,
      );
    } else {
      refused++;
      console.log(`✘ ${record.contractId}: pull refused — ${outcome.refusal}`);
    }
  }
  console.log(
    `\nsync pull: ${canvasRows.length} canvas-ahead record(s) — ${pulled} pulled, ${refused} refused → ${path.relative(ROOT, runDir)}/`,
  );
  console.log('  (proposals are reviewable files only — nothing was applied to contracts/ or the ledger)');
  return undecidedInScope === 0 ? 0 : 1; // the exit mirrors observe: undecided rows, not drift
}

// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  const [verb, ...rest] = process.argv.slice(2);
  switch (verb) {
    case 'record':
      return recordCommand(rest);
    case 'seed':
      return seedCommand(rest);
    case 'observe':
      return observeCommand(rest);
    case 'pending':
      return pendingCommand(rest);
    case 'pull':
      return pullCommand(rest);
    default:
      usage(verb ? `unknown verb "${verb}"` : undefined);
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(`✘ ${String(e instanceof Error ? e.message : e)}`);
    process.exit(2);
  },
);
