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
import { deriveReactChildRoot } from './react-child-root.js';

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

export function selectReactChildRequest(repoRoot: string, reference: ReactReference, parent: ReactNativeRequest,
  instanceId: string): ReactNativeRequest {
  if (parent.version !== 1) throw Error('react-child-parent-root-required');
  const request: ReactNativeRequest = { ...structuredClone(parent), version: 2, selection: { instanceId } };
  readReactNativeEvidence(repoRoot, reference, request);
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
  const captured = request.version === 2 ? JSON.parse(readFileSync(path.join(dir, request.caseId, 'source-tree.json'), 'utf8')) : undefined;
  if (captured && (captured.status !== 'captured' || captured.problems.length || !captured.tree ||
      captured.treeSha256 !== evidenceSha(JSON.stringify(captured.tree)) || captured.treeSha256 !== row.treeSha256)) fail();
  const matrix = request.version === 1 ? structuredClone(row.rootMatrix!) : deriveReactChildRoot(program, row.ownership!, captured.tree,
    JSON.parse(readFileSync(path.join(dir, request.caseId, 'style-origin.json'), 'utf8')), request.selection!.instanceId);
  return { matrix, source: {
    revision: `sha256:${reference.id}`, programSha256: evidenceSha(programBytes), evidenceRevision: revisionOf(request),
  } };
}

export function readReactNativeContentEvidence(repoRoot: string, reference: ReactReference, request: ReactNativeRequest) {
  if (request.version !== 1) throw Error('react-child-content-requires-parent-comparison');
  const original = readReactNativeEvidence(repoRoot, reference, request);
  const dir = path.join(repoRoot, 'private/react-source-ownership', request.referenceId, request.ownership.id);
  const report = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')) as ReactOwnershipReport;
  const captured = JSON.parse(readFileSync(path.join(dir, request.caseId, 'source-tree.json'), 'utf8')) as
    Awaited<ReturnType<typeof import('./capture.js').captureValidatedTree>>;
  if (captured.status !== 'captured' || captured.problems.length || !captured.tree ||
      captured.treeSha256 !== evidenceSha(Buffer.from(JSON.stringify(captured.tree))) ||
      captured.treeSha256 !== report.rows.find(row => row.id === request.caseId)?.treeSha256) return fail();
  return { ...original, captured, observedProps: structuredClone(report.rows.find(row => row.id === request.caseId)?.propertyMatrix?.heldProps) };
}
