/** Durable selection of an explicit structure observation. This is a read pin,
 * never authority to create or update native output. No archive is chosen by age. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { revisionOf } from '../core/contract-provenance.js';
import {assertOutsideEvidenceSnapshot,evidenceReadOnce} from './evidence-read-snapshot.js';
import { evidenceSha, evidenceUnchanged } from './react-validation-evidence.js';
import { reactReferenceUnchanged, type ReactReference } from './react-reference.js';
import { reactSourceProgramUnchanged, type ReactSourceProgram } from './react-source-program.js';
import { reactHelperObservationUnchanged } from './react-helper-observation.js';
import { reactJsxHelperObservationUnchanged } from './react-jsx-helper-observation.js';
import type { ReactOwnershipReport, startReactOwnership } from './react-ownership-run.js';

type Selection = { version: 1; referenceId: string; observationId: string } &
  ({ phase: 'pending' } | { phase: 'sealed'; reportSha256: string; inventorySha256: string });
const hash = /^[a-f0-9]{64}$/;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const directory = (repo: string, referenceId: string) => {
  if (!hash.test(referenceId)) throw Error('react-ownership-selection-invalid');
  return path.join(repo, 'private/react-source-selections', referenceId);
};
const pointer = (repo: string, referenceId: string) => path.join(directory(repo, referenceId), 'selection.json');
function parse(bytes: Buffer): Selection {
  const s = JSON.parse(bytes.toString());
  if (!s || s.version !== 1 || typeof s.referenceId !== 'string' || !hash.test(s.referenceId) ||
      typeof s.observationId !== 'string' || !uuid.test(s.observationId) ||
      !(s.phase === 'pending' && Object.keys(s).sort().join() === 'observationId,phase,referenceId,version' ||
        s.phase === 'sealed' && typeof s.reportSha256 === 'string' && hash.test(s.reportSha256) &&
        typeof s.inventorySha256 === 'string' && hash.test(s.inventorySha256) &&
        Object.keys(s).sort().join() === 'inventorySha256,observationId,phase,referenceId,reportSha256,version'))
    throw Error('react-ownership-selection-invalid');
  return s;
}
function write(repo: string, selection: Selection) {
  assertOutsideEvidenceSnapshot();
  const bytes = Buffer.from(JSON.stringify(selection, null, 2) + '\n'); parse(bytes);
  const dir = directory(repo, selection.referenceId), file = pointer(repo, selection.referenceId);
  if (existsSync(file) && readFileSync(file).equals(bytes)) return;
  mkdirSync(dir, { recursive: true });
  const record = path.join(dir, evidenceSha(bytes) + '.json');
  if (existsSync(record)) {
    if (!readFileSync(record).equals(bytes)) throw Error('react-ownership-selection-record-changed');
  } else writeFileSync(record, bytes, { flag: 'wx' });
  const temporary = path.join(dir, 'selection-' + randomUUID() + '.tmp');
  writeFileSync(temporary, bytes, { flag: 'wx' }); renameSync(temporary, file);
}
export function beginReactOwnershipSelection(repo: string, referenceId: string, observationId: string) {
  write(repo, { version: 1, referenceId, observationId, phase: 'pending' });
}
function readArchive(repo: string, reference: ReactReference, selection: Selection) {
  // A native listing asks for this same selected observation through multiple
  // source/state paths. Authenticate once per synchronous display, with an
  // independent copy for each reader; never retain it into another request.
  return evidenceReadOnce('selected-react-ownership', {repo:path.resolve(repo),selection,
    reference:{id:reference.id,sourceRoot:reference.sourceRoot,cohort:reference.cohort,files:reference.files}},
    () => readArchiveFresh(repo,reference,selection));
}
function readArchiveFresh(repo: string, reference: ReactReference, selection: Selection) {
  if (selection.referenceId !== reference.id) throw Error('react-ownership-selection-reference-mismatch');
  if (selection.phase !== 'sealed') throw Error('react-ownership-selection-incomplete');
  const dir = path.join(repo, 'private/react-source-ownership', reference.id, selection.observationId);
  const sealBytes = readFileSync(path.join(dir, 'integrity.json'));
  if (evidenceSha(sealBytes) !== selection.inventorySha256) throw Error('react-ownership-selection-evidence-changed');
  const seal = JSON.parse(sealBytes.toString());
  if (seal.version !== 1 || !seal.files || typeof seal.files !== 'object' || Array.isArray(seal.files) ||
      seal.files['report.json'] !== selection.reportSha256 || !hash.test(seal.files['program.json']))
    throw Error('react-ownership-selection-evidence-changed');
  const inventory = Object.fromEntries(Object.entries({ ...seal.files, 'integrity.json': selection.inventorySha256 }).sort(([a], [b]) => a.localeCompare(b))) as Record<string, string>;
  if (!evidenceUnchanged(dir, inventory)) throw Error('react-ownership-selection-evidence-changed');
  const state = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')) as ReactOwnershipReport;
  if (state.id !== selection.observationId || state.referenceId !== reference.id ||
      !['complete', 'failed'].includes(state.state) || state.acceptedContract !== null || !Array.isArray(state.rows))
    throw Error('react-ownership-selection-report-invalid');
  const program = JSON.parse(readFileSync(path.join(dir, 'program.json'), 'utf8')) as ReactSourceProgram;
  if (!reactReferenceUnchanged(reference) || !reactSourceProgramUnchanged(program) ||
      state.rows.some(row => (row.helperObservations ?? []).some(h => !reactHelperObservationUnchanged(h)) ||
        (row.jsxHelpers ?? []).some(h => !reactJsxHelperObservationUnchanged(h.result))))
    throw Error('react-ownership-selection-source-changed');
  return { state, dir };
}
export function sealReactOwnershipSelection(repo: string, reference: ReactReference, report: ReactOwnershipReport) {
  assertOutsideEvidenceSnapshot();
  const current = parse(readFileSync(pointer(repo, reference.id)));
  // A late completion cannot replace a newer explicit selection.
  if (current.referenceId !== reference.id || current.observationId !== report.id) return;
  const dir = path.join(repo, 'private/react-source-ownership', reference.id, report.id);
  const reportBytes = readFileSync(path.join(dir, 'report.json'));
  if (revisionOf(JSON.parse(reportBytes.toString())) !== revisionOf(report)) throw Error('react-ownership-selection-report-changed');
  const selection: Selection = { version: 1, referenceId: reference.id, observationId: report.id, phase: 'sealed',
    reportSha256: evidenceSha(reportBytes), inventorySha256: evidenceSha(readFileSync(path.join(dir, 'integrity.json'))) };
  if (current.phase === 'sealed' && revisionOf(current) !== revisionOf(selection))
    throw Error('react-ownership-selection-evidence-changed');
  readArchive(repo, reference, selection); write(repo, selection);
}
export function restoreSelectedReactOwnership(repo: string, reference: ReactReference): ReturnType<typeof startReactOwnership> | undefined {
  const file = pointer(repo, reference.id);
  if (!existsSync(file)) return undefined;
  const selectedBytes = readFileSync(file);
  let selection: Selection | undefined;
  const report = (): ReactOwnershipReport => {
    try {
      selection = parse(selectedBytes);
      if (!readFileSync(file).equals(selectedBytes)) throw Error('react-ownership-selection-changed');
      if (!readFileSync(path.join(directory(repo, reference.id), evidenceSha(selectedBytes) + '.json')).equals(selectedBytes))
        throw Error('react-ownership-selection-record-changed');
      return structuredClone(readArchive(repo, reference, selection).state);
    } catch (error) {
      const problem = error instanceof Error && /^react-ownership-selection-[a-z-]+$/.test(error.message)
        ? error.message : 'react-ownership-selection-evidence-unavailable';
      return { id: selection?.observationId ?? 'selection-unavailable', referenceId: reference.id,
        state: 'failed', acceptedContract: null, denominator: reference.cohort.cases.length,
        matched: 0, rows: [], sourceUnchanged: reactReferenceUnchanged(reference), problem };
    }
  };
  const state = report();
  return { state, dir: selection ? path.join(repo, 'private/react-source-ownership', reference.id, selection.observationId) : directory(repo, reference.id),
    promise: Promise.resolve(), close() {}, report };
}
