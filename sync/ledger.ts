/**
 * SYNC LEDGER — the repo lockfile connecting code (contracts/) to canvas
 * (Figma component sets). One record per synced component: which contract
 * bytes and which canvas bytes were last known to AGREE, so a scheduled
 * observation can classify drift as code-ahead / canvas-ahead / conflict
 * instead of "something changed somewhere".
 *
 * PURE by design (browser-safe, no node:* imports): the CLI package bundles
 * this file, the evals import it directly, and sync/ledger-io.ts owns the
 * filesystem. Deterministic serialization is part of the contract — the
 * ledger is a COMMITTED lockfile, so `serializeLedger(parseLedger(bytes))`
 * must reproduce `bytes` exactly (sorted record order, fixed key order,
 * 2-space indent, trailing newline).
 *
 * THE ECHO-LOOP INVARIANT (unit-pinned in evals/run.ts, case sync-ledger):
 * a code→canvas amend MUST record the resulting new canvas fingerprint at
 * write time (`recordCodeToCanvasSync`), so the NEXT canvas observation sees
 * a stamp that matches the ledger and classifies the change as
 * self-inflicted (in-sync), never canvas-ahead. The same function drops the
 * stale observation baseline for the same reason: the old dump fingerprint
 * describes the canvas this amend just replaced.
 *
 * Fingerprint domains, kept honest and separate:
 *   canvasFingerprint  — the v6 stamp (core/canvas-fingerprint.ts), computed
 *                        IN the Figma runtime and stamped on the set as
 *                        sharedPluginData ds_contracts/canvasFingerprint.
 *                        Writers record it; observe READS the stamp back over
 *                        REST (plugin_data=shared) — it never recomputes v6
 *                        headlessly (REST paint JSON cannot reproduce the
 *                        plugin serialization byte-for-byte, and a second,
 *                        differently-spelled resolver is the drift this repo
 *                        keeps finding).
 *   observed.dumpFingerprint — the observation-domain baseline: a djb2 over
 *                        the canonical JSON of the set's dump-v1 projection
 *                        (extract/figma/rest/map.ts — the mapper built to be
 *                        byte-compatible with the plugin dump). A designer
 *                        edit does NOT restamp v6, so THIS is what catches
 *                        it once a baseline exists.
 */
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';

export const LEDGER_VERSION = 1 as const;
export const DIRECTION_CODE_TO_CANVAS = 'code→canvas';
export const DIRECTION_CANVAS_TO_CODE = 'canvas→code';
export type SyncDirection =
  | typeof DIRECTION_CODE_TO_CANVAS
  | typeof DIRECTION_CANVAS_TO_CODE;

export type RecordProvenance =
  | 'seeded-from-receipts'
  | 'receive-apply'
  | 'publish'
  | 'sync-record'
  | 'observe';

export interface ObservationBaseline {
  /** `dumpv1:<djb2>` over canonicalJson of the set's dump-v1 projection. */
  dumpFingerprint: string;
  /** Figma REST file `version` at observation time (null when the
   *  observation came from a fixture that carries none). */
  fileVersionId: string | null;
  observedAt: string;
}

export interface LedgerRecord {
  contractId: string;
  /** Repo-relative contract path — how observe finds the code half. */
  contractPath: string | null;
  /** canonicalRevisionOf(contract) at last sync ("sha256:…"). */
  contractHash: string | null;
  fileKey: string | null;
  setNodeId: string | null;
  /** The v6 stamp at last sync (see header). Null when the writer honestly
   *  could not know it (publish before apply; a canvas→code envelope carries
   *  no v6). */
  canvasFingerprint: string | null;
  /** The set's ds_contracts/specHash marker when a canvas→code envelope
   *  carried one (baseFreshness.canvasSpecHash) — a weaker canvas identity
   *  than v6, recorded rather than dropped. */
  canvasSpecHash?: string;
  /** Figma REST file version at last sync. Null when the sync path had no
   *  REST access (plugin apply, seeded receipts). */
  lastSyncedVersionId: string | null;
  lastSyncedAt: string;
  direction: SyncDirection;
  /** figma publish records the code half before any canvas applies it; the
   *  next canvas-side sync (recordCodeToCanvasSync) or a confirming
   *  observation (--update) clears this. */
  pendingApply?: true;
  /** Observation-domain baseline (see header). Written by observe --update
   *  and DROPPED by recordCodeToCanvasSync (the amend invalidates it). */
  observed: ObservationBaseline | null;
  provenance: RecordProvenance;
  /** Free-form origin note (e.g. the receipt path a seed came from). */
  note?: string;
}

export interface SyncLedger {
  version: typeof LEDGER_VERSION;
  _doc: string;
  records: LedgerRecord[];
}

export const LEDGER_DOC =
  'SYNC LEDGER (lockfile) — one record per synced component: the contract hash and canvas ' +
  'fingerprint last known to agree. Written by sync verbs (figma receive --apply, figma publish, ' +
  'sync record/seed, sync observe --update); read by `npm run sync:observe`. Deterministic ' +
  'serialization — regenerate with sync/cli.ts, never hand-order. See sync/README.md.';

export function emptyLedger(): SyncLedger {
  return { version: LEDGER_VERSION, _doc: LEDGER_DOC, records: [] };
}

// ---------------------------------------------------------------------------
// Schema referee — refusals by name, never a guess.
// ---------------------------------------------------------------------------

const DIRECTIONS: ReadonlySet<string> = new Set([
  DIRECTION_CODE_TO_CANVAS,
  DIRECTION_CANVAS_TO_CODE,
]);
const PROVENANCES: ReadonlySet<string> = new Set([
  'seeded-from-receipts',
  'receive-apply',
  'publish',
  'sync-record',
  'observe',
]);
const SHA_RE = /^sha256:[0-9a-f]{64}$/;
const V6_RE = /^v6:\d+$/;
const DUMP_FP_RE = /^dumpv1:\d+$/;

function refuse(where: string, detail: string): never {
  throw new Error(`sync ledger invalid — ${where}: ${detail}`);
}

function optString(v: unknown, where: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || v.length === 0)
    refuse(where, 'must be a non-empty string or null');
  return v;
}

export function validateRecord(raw: unknown, where: string): LedgerRecord {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    refuse(where, 'must be an object');
  const o = raw as Record<string, unknown>;
  if (typeof o.contractId !== 'string' || o.contractId.length === 0)
    refuse(`${where}.contractId`, 'must be a non-empty string');
  const contractHash = optString(o.contractHash, `${where}.contractHash`);
  if (contractHash !== null && !SHA_RE.test(contractHash))
    refuse(`${where}.contractHash`, `must be "sha256:<64 hex>" (got ${JSON.stringify(contractHash)})`);
  const canvasFingerprint = optString(o.canvasFingerprint, `${where}.canvasFingerprint`);
  if (canvasFingerprint !== null && !V6_RE.test(canvasFingerprint))
    refuse(`${where}.canvasFingerprint`, `must be a "v6:<digits>" stamp (got ${JSON.stringify(canvasFingerprint)})`);
  if (typeof o.direction !== 'string' || !DIRECTIONS.has(o.direction))
    refuse(
      `${where}.direction`,
      `must be "${DIRECTION_CODE_TO_CANVAS}" or "${DIRECTION_CANVAS_TO_CODE}" (got ${JSON.stringify(o.direction)})`,
    );
  if (typeof o.lastSyncedAt !== 'string' || Number.isNaN(Date.parse(o.lastSyncedAt)))
    refuse(`${where}.lastSyncedAt`, 'must be an ISO-8601 timestamp');
  if (typeof o.provenance !== 'string' || !PROVENANCES.has(o.provenance))
    refuse(`${where}.provenance`, `must be one of ${[...PROVENANCES].join(' | ')} (got ${JSON.stringify(o.provenance)})`);
  if (o.pendingApply !== undefined && o.pendingApply !== true)
    refuse(`${where}.pendingApply`, 'is present-true or absent — never false');
  let observed: ObservationBaseline | null = null;
  if (o.observed !== null && o.observed !== undefined) {
    const ob = o.observed as Record<string, unknown>;
    if (typeof ob !== 'object' || Array.isArray(ob))
      refuse(`${where}.observed`, 'must be an object or null');
    if (typeof ob.dumpFingerprint !== 'string' || !DUMP_FP_RE.test(ob.dumpFingerprint))
      refuse(`${where}.observed.dumpFingerprint`, 'must be a "dumpv1:<digits>" fingerprint');
    if (typeof ob.observedAt !== 'string' || Number.isNaN(Date.parse(ob.observedAt)))
      refuse(`${where}.observed.observedAt`, 'must be an ISO-8601 timestamp');
    observed = {
      dumpFingerprint: ob.dumpFingerprint,
      fileVersionId: optString(ob.fileVersionId, `${where}.observed.fileVersionId`),
      observedAt: ob.observedAt,
    };
  }
  return {
    contractId: o.contractId,
    contractPath: optString(o.contractPath, `${where}.contractPath`),
    contractHash,
    fileKey: optString(o.fileKey, `${where}.fileKey`),
    setNodeId: optString(o.setNodeId, `${where}.setNodeId`),
    canvasFingerprint,
    ...(o.canvasSpecHash !== undefined && o.canvasSpecHash !== null
      ? { canvasSpecHash: String(o.canvasSpecHash) }
      : {}),
    lastSyncedVersionId: optString(o.lastSyncedVersionId, `${where}.lastSyncedVersionId`),
    lastSyncedAt: o.lastSyncedAt,
    direction: o.direction as SyncDirection,
    ...(o.pendingApply === true ? { pendingApply: true as const } : {}),
    observed,
    provenance: o.provenance as RecordProvenance,
    ...(typeof o.note === 'string' && o.note.length > 0 ? { note: o.note } : {}),
  };
}

export function validateLedger(raw: unknown): SyncLedger {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    refuse('(root)', 'must be an object');
  const o = raw as Record<string, unknown>;
  if (o.version !== LEDGER_VERSION) refuse('version', `must equal ${LEDGER_VERSION}`);
  if (!Array.isArray(o.records)) refuse('records', 'must be an array');
  const records = o.records.map((r, i) => validateRecord(r, `records[${i}]`));
  const seen = new Set<string>();
  for (const r of records) {
    const key = recordKey(r);
    if (seen.has(key))
      refuse('records', `duplicate record for ${key} — one record per component per file`);
    seen.add(key);
  }
  return { version: LEDGER_VERSION, _doc: LEDGER_DOC, records };
}

export function parseLedger(text: string): SyncLedger {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    refuse('(bytes)', `not JSON — ${String(e instanceof Error ? e.message : e)}`);
  }
  return validateLedger(raw);
}

// ---------------------------------------------------------------------------
// Deterministic serialization — sorted records, fixed key order.
// ---------------------------------------------------------------------------

/** Identity: a component is (contractId, fileKey) — the same contract synced
 *  into two files is two records. */
export const recordKey = (r: Pick<LedgerRecord, 'contractId' | 'fileKey'>): string =>
  `${r.contractId}@${r.fileKey ?? '(no-file)'}`;

const RECORD_KEY_ORDER: Array<keyof LedgerRecord> = [
  'contractId',
  'contractPath',
  'contractHash',
  'fileKey',
  'setNodeId',
  'canvasFingerprint',
  'canvasSpecHash',
  'lastSyncedVersionId',
  'lastSyncedAt',
  'direction',
  'pendingApply',
  'observed',
  'provenance',
  'note',
];

export function serializeLedger(ledger: SyncLedger): string {
  const records = [...ledger.records]
    .sort((a, b) => (recordKey(a) < recordKey(b) ? -1 : recordKey(a) > recordKey(b) ? 1 : 0))
    .map((r) => {
      const out: Record<string, unknown> = {};
      for (const k of RECORD_KEY_ORDER) {
        const v = r[k];
        if (v !== undefined) out[k] = v;
      }
      return out;
    });
  return (
    JSON.stringify({ version: ledger.version, _doc: LEDGER_DOC, records }, null, 2) + '\n'
  );
}

// ---------------------------------------------------------------------------
// Writers — each sync verb records what it just did.
// ---------------------------------------------------------------------------

function upsert(ledger: SyncLedger, record: LedgerRecord): SyncLedger {
  const key = recordKey(record);
  const records = ledger.records.filter((r) => recordKey(r) !== key);
  records.push(record);
  return { ...ledger, records };
}

export interface CodeToCanvasSync {
  contractId: string;
  contractPath?: string | null;
  contractHash: string;
  fileKey: string | null;
  setNodeId: string | null;
  /** REQUIRED (the echo-loop invariant): the v6 stamp the amend just wrote.
   *  A caller that cannot supply it must not claim a code→canvas sync. */
  canvasFingerprint: string;
  versionId?: string | null;
  at: string;
  provenance?: RecordProvenance;
  note?: string;
}

/** Record a completed code→canvas write (generate / apply / amend). Drops the
 *  stale observation baseline and any pendingApply — this IS the apply. */
export function recordCodeToCanvasSync(ledger: SyncLedger, sync: CodeToCanvasSync): SyncLedger {
  if (!V6_RE.test(sync.canvasFingerprint)) {
    throw new Error(
      `recordCodeToCanvasSync(${sync.contractId}): a code→canvas sync MUST record the resulting v6 canvas fingerprint ` +
        `(got ${JSON.stringify(sync.canvasFingerprint)}) — without it the next observation classifies this self-inflicted ` +
        'write as canvas-ahead (the echo-loop false alarm this ledger exists to prevent)',
    );
  }
  const prior = ledger.records.find(
    (r) => recordKey(r) === recordKey({ contractId: sync.contractId, fileKey: sync.fileKey }),
  );
  return upsert(ledger, {
    contractId: sync.contractId,
    contractPath: sync.contractPath ?? prior?.contractPath ?? null,
    contractHash: sync.contractHash,
    fileKey: sync.fileKey,
    setNodeId: sync.setNodeId ?? prior?.setNodeId ?? null,
    canvasFingerprint: sync.canvasFingerprint,
    lastSyncedVersionId: sync.versionId ?? null,
    lastSyncedAt: sync.at,
    direction: DIRECTION_CODE_TO_CANVAS,
    observed: null, // the amend replaced the canvas the old baseline described
    provenance: sync.provenance ?? 'sync-record',
    ...(sync.note ? { note: sync.note } : {}),
  });
}

export interface CanvasToCodeSync {
  contractId: string;
  contractPath?: string | null;
  contractHash: string;
  canvasSpecHash?: string | null;
  at: string;
  note?: string;
}

/** Record a completed canvas→code landing (figma receive --apply). The
 *  envelope carries no fileKey/setNodeId/v6 — recorded as null, honestly,
 *  and preserved from a prior record when one exists. */
export function recordCanvasToCodeSync(ledger: SyncLedger, sync: CanvasToCodeSync): SyncLedger {
  const prior =
    ledger.records.find((r) => r.contractId === sync.contractId) ?? null;
  return upsert(ledger, {
    contractId: sync.contractId,
    contractPath: sync.contractPath ?? prior?.contractPath ?? null,
    contractHash: sync.contractHash,
    fileKey: prior?.fileKey ?? null,
    setNodeId: prior?.setNodeId ?? null,
    canvasFingerprint: prior?.canvasFingerprint ?? null,
    ...(sync.canvasSpecHash ? { canvasSpecHash: sync.canvasSpecHash } : {}),
    lastSyncedVersionId: null,
    lastSyncedAt: sync.at,
    direction: DIRECTION_CANVAS_TO_CODE,
    observed: prior?.observed ?? null,
    provenance: 'receive-apply',
    ...(sync.note ? { note: sync.note } : {}),
  });
}

export interface PublishSync {
  contractId: string;
  contractPath?: string | null;
  contractHash: string;
  at: string;
  note?: string;
}

/** Record a publish: the CODE half moved; the canvas half is pending until a
 *  designer applies (pendingApply — cleared by recordCodeToCanvasSync or by
 *  a confirming observation via observe --update). */
export function recordPublish(ledger: SyncLedger, sync: PublishSync): SyncLedger {
  const prior =
    ledger.records.find((r) => r.contractId === sync.contractId) ?? null;
  return upsert(ledger, {
    contractId: sync.contractId,
    contractPath: sync.contractPath ?? prior?.contractPath ?? null,
    contractHash: sync.contractHash,
    fileKey: prior?.fileKey ?? null,
    setNodeId: prior?.setNodeId ?? null,
    canvasFingerprint: prior?.canvasFingerprint ?? null,
    lastSyncedVersionId: prior?.lastSyncedVersionId ?? null,
    lastSyncedAt: sync.at,
    direction: DIRECTION_CODE_TO_CANVAS,
    pendingApply: true,
    observed: prior?.observed ?? null,
    provenance: 'publish',
    ...(sync.note ? { note: sync.note } : {}),
  });
}

// ---------------------------------------------------------------------------
// The drift arithmetic — what `sync observe` runs.
// ---------------------------------------------------------------------------

export type DriftStatus = 'in-sync' | 'code-ahead' | 'canvas-ahead' | 'conflict' | 'untracked';

/** What one headless look at a set yields (sync/observe.ts builds these from
 *  REST or a committed fixture). */
export interface SetObservation {
  fileKey: string | null;
  setNodeId: string;
  setName: string;
  /** sharedPluginData ds_contracts/canvasFingerprint, read back over REST
   *  (plugin_data=shared). Null when the node carries no stamp. */
  stamp: string | null;
  /** Observation-domain fingerprint over the set's dump-v1 projection. */
  dumpFingerprint: string;
  fileVersionId: string | null;
}

export type CanvasEvidence = 'baseline' | 'stamp' | 'version' | 'none' | 'unobserved';

export interface DriftRow {
  key: string;
  contractId: string;
  status: DriftStatus;
  codeChanged: boolean | null; // null = contract file missing/unhashable
  canvasChanged: boolean | null; // null = no evidence either way
  canvasEvidence: CanvasEvidence;
  notes: string[];
}

/** Classify ONE record against the current contract hash and the current
 *  canvas observation. PURE — this is the arithmetic the scheduled spine
 *  runs. */
export function classifyRecord(
  record: LedgerRecord,
  currentContractHash: string | null,
  obs: SetObservation | undefined,
): DriftRow {
  const notes: string[] = [];
  let codeChanged: boolean | null;
  if (currentContractHash === null) {
    codeChanged = null;
    notes.push('contract file missing or unreadable — code half unverifiable');
  } else if (record.contractHash === null) {
    codeChanged = null;
    notes.push('ledger carries no contract hash — code half unverifiable');
  } else {
    codeChanged = currentContractHash !== record.contractHash;
  }

  let canvasChanged: boolean | null = null;
  let canvasEvidence: CanvasEvidence = 'unobserved';
  if (obs !== undefined) {
    // Stamps compare only WITHIN a fingerprint version. Live finding
    // (2026-08-08, MUI Test 1): sets generated by a v5-era engine still carry
    // v5 stamps while the receipts recorded freshly computed v6 values —
    // "v5:… ≠ v6:…" is not evidence of a re-stamp, it is two instruments.
    // Incomparable stamps fall through to baseline/version evidence, named.
    const stampVersion = (s: string): string => s.slice(0, s.indexOf(':') + 1);
    const bothStamped = obs.stamp !== null && record.canvasFingerprint !== null;
    const stampComparable =
      bothStamped && stampVersion(obs.stamp!) === stampVersion(record.canvasFingerprint!);
    if (bothStamped && !stampComparable) {
      notes.push(
        `canvas stamp ${obs.stamp} and ledger ${record.canvasFingerprint} are different fingerprint versions — ` +
          'incomparable (the set predates the recorded version); drift detection rides the observation baseline instead',
      );
    }
    const stampChanged = stampComparable && obs.stamp !== record.canvasFingerprint;
    const baselineComparable = record.observed !== null;
    const baselineChanged =
      baselineComparable && obs.dumpFingerprint !== record.observed!.dumpFingerprint;
    if (stampChanged) {
      canvasChanged = true;
      canvasEvidence = 'stamp';
      notes.push(
        `canvas stamp ${obs.stamp} ≠ ledger ${record.canvasFingerprint} — the set was re-stamped by a write this ledger did not record`,
      );
    } else if (baselineComparable) {
      canvasChanged = baselineChanged;
      canvasEvidence = 'baseline';
      if (baselineChanged)
        notes.push(
          `dump fingerprint ${obs.dumpFingerprint} ≠ baseline ${record.observed!.dumpFingerprint} — the canvas was edited without a restamp (designer edit)`,
        );
    } else if (stampComparable) {
      // Stamp matches and no baseline yet: the set still carries exactly the
      // stamp this ledger recorded. Designer edits are invisible to the stamp
      // — named here, closed the first time observe --update records a
      // baseline.
      canvasChanged = false;
      canvasEvidence = 'stamp';
      notes.push('stamp matches; no observation baseline yet (run observe --update to record one)');
    } else if (
      record.lastSyncedVersionId !== null &&
      obs.fileVersionId !== null &&
      obs.fileVersionId === record.lastSyncedVersionId
    ) {
      canvasChanged = false;
      canvasEvidence = 'version';
      notes.push('file version unchanged since last sync');
    } else {
      canvasEvidence = 'none';
      notes.push('no canvas evidence (no stamp, no baseline, no matching version) — canvas half unverifiable');
    }
  } else {
    notes.push('set not present in this observation');
  }

  if (record.pendingApply) notes.push('publish pending apply — the canvas has not adopted this contract yet');

  const code = codeChanged === true || record.pendingApply === true;
  const canvas = canvasChanged === true;
  const status: DriftStatus =
    code && canvas ? 'conflict' : code ? 'code-ahead' : canvas ? 'canvas-ahead' : 'in-sync';
  return {
    key: recordKey(record),
    contractId: record.contractId,
    status,
    codeChanged,
    canvasChanged,
    canvasEvidence,
    notes,
  };
}

export interface DriftReport {
  rows: DriftRow[];
  /** Observed sets with NO ledger record — drift by definition. */
  untracked: Array<{ fileKey: string | null; setNodeId: string; setName: string }>;
  clean: boolean;
}

/** The full table: every ledger record classified, plus untracked observed
 *  sets. `clean` mirrors the gate exit code (0 clean, 1 drift). */
export function driftReport(
  ledger: SyncLedger,
  contractHashes: ReadonlyMap<string, string | null>,
  observations: readonly SetObservation[],
  opts: { fileKeys?: ReadonlySet<string> } = {},
): DriftReport {
  const byNode = new Map<string, SetObservation>();
  for (const o of observations) byNode.set(`${o.fileKey ?? '(no-file)'}#${o.setNodeId}`, o);
  const records = opts.fileKeys
    ? ledger.records.filter((r) => r.fileKey !== null && opts.fileKeys!.has(r.fileKey))
    : ledger.records;
  const rows = records
    .map((r) =>
      classifyRecord(
        r,
        contractHashes.get(recordKey(r)) ?? null,
        r.setNodeId !== null
          ? byNode.get(`${r.fileKey ?? '(no-file)'}#${r.setNodeId}`)
          : undefined,
      ),
    )
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const trackedNodes = new Set(
    records.filter((r) => r.setNodeId !== null).map((r) => `${r.fileKey ?? '(no-file)'}#${r.setNodeId}`),
  );
  const untracked = observations
    .filter((o) => !trackedNodes.has(`${o.fileKey ?? '(no-file)'}#${o.setNodeId}`))
    .map((o) => ({ fileKey: o.fileKey, setNodeId: o.setNodeId, setName: o.setName }))
    .sort((a, b) => (a.setNodeId < b.setNodeId ? -1 : 1));
  const clean = untracked.length === 0 && rows.every((r) => r.status === 'in-sync');
  return { rows, untracked, clean };
}

// ---------------------------------------------------------------------------
// Fingerprint + hash helpers shared by observe and the seeders.
// ---------------------------------------------------------------------------

/** djb2 (the same hash v6 uses) over canonicalJson — the observation-domain
 *  fingerprint for a set's dump-v1 projection. */
export function dumpFingerprint(dumpEntry: unknown): string {
  const s = canonicalJson(dumpEntry);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `dumpv1:${h}`;
}

/** canonicalRevisionOf, spelled here so callers hash the raw parsed document
 *  (provenance excluded — provenance edits are bookkeeping, not drift). */
export function contractHashOf(contract: Record<string, unknown>): string {
  const { provenance: _ignored, ...canonical } = contract;
  return revisionOf(canonical);
}
