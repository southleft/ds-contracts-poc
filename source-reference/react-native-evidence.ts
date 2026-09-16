/** Host-owned selection and re-opening of sealed React source evidence.
 * No path, Contract, native ID or script is accepted from a browser request.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { revisionOf } from '../core/contract-provenance.js';
import { evidenceSha, evidenceUnchanged } from './react-validation-evidence.js';
import { reactReferenceUnchanged, type ReactReference } from './react-reference.js';
import { reactSourceProgramUnchanged, type ReactSourceProgram } from './react-source-program.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import { isReactNativeRequest, type ReactNativeRequest } from './react-native-request.js';

const fail = (): never => { throw Error('react-native-evidence-unavailable'); };
/** Only call with the current runner's already authenticated report. */
export function selectReactNativeRequest(repoRoot: string, report: ReactOwnershipReport, caseId: string): ReactNativeRequest {
  const row = report.rows.find(r => r.id === caseId);
  if (!row) return fail();
  if (report.state !== 'complete' || !report.sourceUnchanged || report.problem ||
      !row?.matched || row.problems.length || row.rootMatrix?.draft?.status !== 'native-compiled') fail();
  const dir = path.join(repoRoot, 'private/react-source-ownership', report.referenceId, report.id);
  const bytes = readFileSync(path.join(dir, 'report.json'));
  if (revisionOf(JSON.parse(bytes.toString())) !== revisionOf(report)) fail();
  const request: ReactNativeRequest = { version: 1, kind: 'react-root-draft', referenceId: report.referenceId,
    ownership: { id: report.id, sha256: evidenceSha(bytes) }, caseId,
    inventorySha256: evidenceSha(readFileSync(path.join(dir, 'integrity.json'))), matrixRevision: revisionOf(row.rootMatrix) };
  if (!isReactNativeRequest(request)) fail();
  return request;
}

/** Existing journal requests retain these exact hashes across restarts. A new
 * request must first come from selectReactNativeRequest on a current runner. */
export function readReactNativeEvidence(repoRoot: string, reference: ReactReference, request: ReactNativeRequest) {
  if (!isReactNativeRequest(request) || reference.id !== request.referenceId || !reactReferenceUnchanged(reference)) fail();
  const dir = path.join(repoRoot, 'private/react-source-ownership', request.referenceId, request.ownership.id);
  const sealBytes = readFileSync(path.join(dir, 'integrity.json'));
  if (evidenceSha(sealBytes) !== request.inventorySha256) fail();
  const seal = JSON.parse(sealBytes.toString());
  if (seal.version !== 1 || !seal.files || typeof seal.files !== 'object' || Array.isArray(seal.files)) fail();
  const files = Object.fromEntries(Object.entries({ ...seal.files, 'integrity.json': request.inventorySha256 })
    .sort(([a], [b]) => a.localeCompare(b))) as Record<string, string>;
  if (!evidenceUnchanged(dir, files)) fail();
  const reportBytes = readFileSync(path.join(dir, 'report.json'));
  if (evidenceSha(reportBytes) !== request.ownership.sha256) fail();
  const report = JSON.parse(reportBytes.toString()) as ReactOwnershipReport;
  const row = report.rows.find(r => r.id === request.caseId);
  if (!row) return fail();
  if (report.id !== request.ownership.id || report.referenceId !== request.referenceId ||
      report.state !== 'complete' || !report.sourceUnchanged || report.problem ||
      !row?.matched || row.problems.length || row.rootMatrix?.draft?.status !== 'native-compiled' ||
      revisionOf(row.rootMatrix) !== request.matrixRevision) fail();
  const programBytes = readFileSync(path.join(dir, 'program.json'));
  const program = JSON.parse(programBytes.toString()) as ReactSourceProgram;
  if (!reactSourceProgramUnchanged(program) || !reactReferenceUnchanged(reference)) fail();
  return { matrix: structuredClone(row.rootMatrix!), source: {
    revision: `sha256:${reference.id}`, programSha256: evidenceSha(programBytes), evidenceRevision: revisionOf(request),
  } };
}
