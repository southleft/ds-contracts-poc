/** Read-only application view of a recorded, operation-bound measurement. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { revisionOf } from '../core/contract-provenance.js';
import { MATCHED_EVIDENCE, scoreMatchedEvidence, type MatchedManifest } from '../scripts/react-native-matched-check.js';
import { sha256 } from '../scripts/react-native-fidelity-check.js';
import { authenticateMatchedOperation } from '../scripts/react-native-matched-record.js';
import type { ReactInitialNativeRequest } from './react-initial-native-request.js';

const evidenceDir = (repo: string) => path.join(repo, MATCHED_EVIDENCE);
function manifest(repo: string): MatchedManifest {
  return JSON.parse(readFileSync(path.join(evidenceDir(repo), 'manifest.json'), 'utf8'));
}
export function hasRecordedNativeMeasurement(repo: string, operationId: string, referenceId: string): boolean {
  if (!existsSync(path.join(evidenceDir(repo), 'manifest.json'))) return false;
  try {
    const m = manifest(repo);
    return m.cohort.native.operationId === operationId && m.cohort.source.referenceId === referenceId;
  } catch { return false; }
}
export interface RecordedNativeMeasurement {
  recordedAt: string; sourceCase: string; scope: 'recorded-initial-states';
  rows: Array<{ id: string; variant: string; width: number; height: number; sourceImage: string; nativeImage: string;
    whiteMismatch: number; blackMismatch: number; pass: boolean }>;
}
export function readRecordedNativeMeasurement(repo: string, operationId: string, request: ReactInitialNativeRequest): RecordedNativeMeasurement {
  const m = manifest(repo);
  if (m.cohort.native.operationId !== operationId || m.cohort.source.referenceId !== request.anchor.referenceId ||
      m.cohort.source.caseId !== request.caseId || m.cohort.source.inspectionId !== request.observation.id ||
      m.cohort.source.reportSha256 !== request.observation.reportSha256 ||
      m.cohort.source.inventorySha256 !== request.observation.inventorySha256) throw Error('matched-review-operation-mismatch');
  const { kind: _kind, observation, ...inspection } = request;
  const current = authenticateMatchedOperation(path.join(repo, 'private'), {
    id: m.cohort.id, component: m.cohort.component, description: 'Recorded native measurement', operation: operationId,
    journal: 'source-native-app/operations/' + operationId, event: String(m.cohort.native.journalEvent),
    source: { kind: 'initial', inspection: 'react-initial-inspections/' + revisionOf(inspection).slice(7) + '/' + observation.id },
  });
  if (current.native.journalEventSha256 !== m.cohort.native.journalEventSha256 ||
      current.native.planRevision !== m.cohort.native.planRevision) throw Error('matched-review-journal-mismatch');
  const rows = scoreMatchedEvidence(evidenceDir(repo), m);
  return { recordedAt: String(m.cohort.native.recordedAt), sourceCase: request.caseId, scope: 'recorded-initial-states',
    rows: rows.map(row => {
      const s = m.rows.find(s => s.id === row.id)!;
      const image = (side: 'source' | 'native') => {
        const data = readFileSync(path.join(evidenceDir(repo), row.id + '.' + side + '.png'));
        if (sha256(data) !== s.files[side]) throw Error('matched-review-image-changed');
        return 'data:image/png;base64,' + data.toString('base64');
      };
      return { id: row.id, variant: row.variant, width: s.source.crop.width, height: s.source.crop.height,
        sourceImage: image('source'), nativeImage: image('native'), whiteMismatch: row.scores[0]!.mismatch,
        blackMismatch: row.scores[1]!.mismatch, pass: row.pass };
    }) };
}
