/** Read-only application view of a recorded, operation-bound measurement. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual as same } from 'node:util';
import type { ReactNativeRequest } from './react-native-request.js';
import type { MatchedSpec } from '../scripts/react-native-matched-record.js';
import { revisionOf } from '../core/contract-provenance.js';
import { MATCHED_EVIDENCE_DIRS, scoreMatchedEvidence, type MatchedManifest } from '../scripts/react-native-matched-check.js';
import { sha256 } from '../scripts/react-native-fidelity-check.js';
import { authenticateMatchedOperation } from '../scripts/react-native-matched-record.js';
import type { ReactInitialNativeRequest } from './react-initial-native-request.js';

function recorded(repo: string, operationId: string, referenceId: string) {
  const matches = MATCHED_EVIDENCE_DIRS.flatMap(relative => {
    const dir = path.join(repo, relative), file = path.join(dir, 'manifest.json');
    if (!existsSync(file)) return [];
    const m = JSON.parse(readFileSync(file, 'utf8')) as MatchedManifest;
    return m.cohort.native.operationId === operationId && m.cohort.source.referenceId === referenceId ? [{dir, m}] : [];
  });
  if (matches.length !== 1) throw Error('matched-review-operation-mismatch');
  return matches[0]!;
}
export function hasRecordedNativeMeasurement(repo: string, operationId: string, referenceId: string): boolean {
  try { recorded(repo, operationId, referenceId); return true; } catch { return false; }
}
export interface RecordedNativeMeasurement {
  recordedAt: string; sourceCase: string; scope: 'recorded-initial-states' | 'recorded-caller-content';
  rows: Array<{ id: string; variant: string; width: number; height: number; sourceImage: string; nativeImage: string;
    whiteMismatch: number; blackMismatch: number; pass: boolean }>;
}
export function assertMatchedManifestBinding(m: MatchedManifest, pairs: Array<{observation: string; variant: string; native: {nodeId: string}; source: {originalSha256: string; bounds: unknown; crop: unknown}}>) {
  if (pairs.length !== m.rows.length || pairs.some(pair => {
    const matches = m.rows.filter(row => row.id === pair.observation);
    if (matches.length !== 1) return true;
    const row = matches[0]!;
    return row.variant !== pair.variant || row.native.originalId !== pair.native.nodeId ||
      row.source.originalSha256 !== pair.source.originalSha256 || !same(row.source.bounds, pair.source.bounds) || !same(row.source.crop, pair.source.crop);
  })) throw Error('matched-review-pairing-mismatch');
}
export function readRecordedNativeMeasurement(repo: string, operationId: string, request: ReactInitialNativeRequest | ReactNativeRequest): RecordedNativeMeasurement {
  const initial = request.kind === 'react-initial-draft';
  const referenceId = initial ? request.anchor.referenceId : request.referenceId;
  const {m, dir} = recorded(repo, operationId, referenceId);
  const pin = initial ? request.observation : {id: request.ownership.id, reportSha256: request.ownership.sha256, inventorySha256: request.inventorySha256};
  if (m.cohort.source.caseId !== request.caseId ||
      (initial ? m.cohort.source.inspectionId : m.cohort.source.ownershipId) !== pin.id ||
      m.cohort.source.reportSha256 !== pin.reportSha256 || m.cohort.source.inventorySha256 !== pin.inventorySha256) throw Error('matched-review-operation-mismatch');
  let source: MatchedSpec['source'];
  if (initial) {
    const {kind: _kind, observation, ...inspection} = request;
    source = {kind: 'initial', inspection: 'react-initial-inspections/' + revisionOf(inspection).slice(7) + '/' + observation.id};
  } else source = {kind: 'comparison', bounds: m.rows[0]!.source.bounds};
  const current = authenticateMatchedOperation(path.join(repo, 'private'), {
    id: m.cohort.id, component: m.cohort.component, description: 'Recorded native measurement', operation: operationId,
    journal: 'source-native-app/operations/' + operationId, event: String(m.cohort.native.journalEvent), source,
  });
  if (!same(current.sourceRequest, request)) throw Error('matched-review-source-request-mismatch');
  if (current.native.journalEventSha256 !== m.cohort.native.journalEventSha256 ||
      current.native.planRevision !== m.cohort.native.planRevision) throw Error('matched-review-journal-mismatch');
  assertMatchedManifestBinding(m, current.pairs);
  const rows = scoreMatchedEvidence(dir, m);
  return { recordedAt: String(m.cohort.native.recordedAt), sourceCase: request.caseId, scope: initial ? 'recorded-initial-states' : 'recorded-caller-content',
    rows: rows.map(row => {
      const s = m.rows.find(s => s.id === row.id)!;
      const image = (side: 'source' | 'native') => {
        const data = readFileSync(path.join(dir, row.id + '.' + side + '.png'));
        if (sha256(data) !== s.files[side]) throw Error('matched-review-image-changed');
        return 'data:image/png;base64,' + data.toString('base64');
      };
      return { id: row.id, variant: row.variant, width: s.source.crop.width, height: s.source.crop.height,
        sourceImage: image('source'), nativeImage: image('native'), whiteMismatch: row.scores[0]!.mismatch,
        blackMismatch: row.scores[1]!.mismatch, pass: row.pass };
    }) };
}
