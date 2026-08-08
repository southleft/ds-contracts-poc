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
 *            [--ledger <path>]
 *       THE DRIFT ARITHMETIC. Reads the current canvas state headlessly —
 *       from a committed ObservationFixture (offline, gate-shaped) or live
 *       over the Figma REST API (FIGMA_TOKEN; per-set stamp via
 *       plugin_data=shared + file version + dump-v1 fingerprint) — plus the
 *       current contract hashes, and classifies every ledger record:
 *       in-sync | code-ahead | canvas-ahead | conflict | untracked.
 *       Exit gate-style: 0 clean, 1 drift, 2 usage/config error.
 *       --update records observation baselines for in-sync rows (and adopts
 *       a post-publish restamp, clearing pendingApply — noted loudly).
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
  contractHashOf,
  driftReport,
  recordCodeToCanvasSync,
  recordKey,
  type DriftRow,
  type LedgerRecord,
  type SetObservation,
  type SyncLedger,
} from './ledger.js';
import { DEFAULT_LEDGER_PATH, loadLedger, loadOrInitLedger, saveLedger } from './ledger-io.js';
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

function usage(msg?: string): never {
  if (msg) console.error(`✘ ${msg}`);
  console.error('Usage: sync/cli.ts record|seed|observe|pull — see the header of sync/cli.ts');
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
  const update = has(args, 'update');

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

  if (update) {
    const byNode = new Map(observations.map((o) => [`${o.fileKey ?? '(no-file)'}#${o.setNodeId}`, o]));
    let updated = 0;
    ledger = {
      ...ledger,
      records: ledger.records.map((r) => {
        const obs = r.setNodeId ? byNode.get(`${r.fileKey ?? '(no-file)'}#${r.setNodeId}`) : undefined;
        if (!obs) return r;
        const row = report.rows.find((x) => x.key === recordKey(r));
        if (!row) return r;
        if (row.status === 'in-sync' && !r.pendingApply) {
          updated++;
          return {
            ...r,
            observed: {
              dumpFingerprint: obs.dumpFingerprint,
              fileVersionId: obs.fileVersionId,
              observedAt: new Date().toISOString(),
            },
          };
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
            observed: {
              dumpFingerprint: obs.dumpFingerprint,
              fileVersionId: obs.fileVersionId,
              observedAt: new Date().toISOString(),
            },
            provenance: 'observe' as const,
          };
        }
        return r;
      }),
    };
    saveLedger(ledgerPath, ledger);
    console.log(`✔ --update: ${updated} observation baseline(s) recorded → ${ledgerPath}`);
  }

  return report.clean ? 0 : 1;
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
  if (canvasRows.length === 0) {
    console.log('sync pull: no canvas-ahead record in scope — nothing to pull');
    return rows.every((r) => r.status === 'in-sync') ? 0 : 1;
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
  return 1; // canvas-ahead records existed — the drift exit mirrors observe
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
