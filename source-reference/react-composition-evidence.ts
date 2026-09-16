/** Reopen sealed host evidence. No browser-provided paths or native IDs. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { evidenceSha } from './react-validation-evidence.js';
import { reactComparisonVariant } from './react-comparison-plan.js';
import { readReactNativeContentEvidence } from './react-native-evidence.js';
import { compileObservedContent } from './observed-content.js';
import { matchReactComposition, type ReactCompositionMain } from './react-composition.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import type { ReactSourceProgram } from './react-source-program.js';
import type { ReactNativeRequest } from './react-native-request.js';
import type { ReactReference } from './react-reference.js';
import type { createNativeOperationJobs } from './native-operation-jobs.js';
import type { ReactPropertySnapshot } from './react-root-variants.js';
import { readReactContentInspection } from './react-content-inspection.js';
import { flatten } from '../extract/computed/lib.js';

export function readReactCompositionEvidence(repo: string, reference: ReactReference, request: ReactNativeRequest,
  parentId: string, jobs: Pick<ReturnType<typeof createNativeOperationJobs>, 'listReact' | 'verifiedReactObservation'>,
  pinnedContent?: { id: string; inventorySha256: string }) {
  const original = readReactNativeContentEvidence(repo, reference, request);
  const dir = path.join(repo, 'private/react-source-ownership', request.referenceId, request.ownership.id);
  // The original reader already authenticated every file in this inventory.
  const report = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')) as ReactOwnershipReport;
  const row = report.rows.find(r => r.id === request.caseId)!;
  const program = JSON.parse(readFileSync(path.join(dir, 'program.json'), 'utf8')) as ReactSourceProgram;
  if (!row.ownership) throw Error('react-composition-ownership-unavailable');
  const saved = readReactContentInspection(repo, reference, request, parentId, pinnedContent);
  if (!saved || saved.phase !== 'complete' || !saved.sourceUnchanged || saved.content?.status !== 'compiled-comparison-draft')
    throw Error('react-composition-content-unavailable');
  const contentDir = path.join(repo, 'private/react-content-inspections', parentId, saved.id);
  const read = (name: string) => JSON.parse(readFileSync(path.join(contentDir, name), 'utf8'));
  const sourceNodes = new Map(flatten(original.captured.tree).map(n => [n.path, n.node]));
  // Keep the observed flex box around a source component's anonymous text item.
  // This does not infer a text-only public children API or a block/grid rule.
  const boundaries = row.ownership.components.flatMap(c => c.roots).filter(p => p !== '' &&
    ['flex', 'inline-flex'].includes(sourceNodes.get(p)?.style.display ?? ''));
  const content = compileObservedContent(original.captured.tree, read('text-fonts.json'), read('svg-viewports.json'), true,
    [...new Set(boundaries)].sort());
  const mains: ReactCompositionMain[] = [];
  const sources = row.ownership.components.filter(c => !c.roots.includes('')).map(c => JSON.stringify(c.source));
  for (const operation of jobs.listReact(reference.id, 'root').sort((a, b) => a.operation.id.localeCompare(b.operation.id))) {
    if (operation.kind !== 'root' || operation.operation.id === parentId ||
        operation.ownershipId !== request.ownership.id || operation.operation.phase !== 'component-structure-observed' || !operation.operation.sourceCurrent) continue;
    const candidate = report.rows.find(r => r.id === operation.caseId);
    if (!candidate?.propertyMatrix || !candidate.rootMatrix?.draft?.contract ||
        !sources.includes(JSON.stringify(candidate.propertyMatrix.source))) continue;
    const observed = jobs.verifiedReactObservation(operation.operation.id);
    // Reuse only this exact ownership archive, not another same-named export.
    if (observed.request.ownership.sha256 !== request.ownership.sha256 || observed.request.inventorySha256 !== request.inventorySha256)
      throw Error('react-composition-candidate-archive-changed');
    const matrix = candidate.propertyMatrix, styles: ReactCompositionMain['styles'] = {};
    for (const plane of matrix.rows) {
      if (!/^\d+$/.test(plane.id) || plane.status !== 'observed' || !plane.restored) throw Error('react-composition-source-plane-unavailable');
      const snapshot = JSON.parse(readFileSync(path.join(dir, candidate.id, 'matrix', plane.id + '.json'), 'utf8')) as ReactPropertySnapshot;
      const instance = snapshot.ownership.components.find(c => c.id === matrix.instanceId);
      if (!instance || instance.roots.length !== 1 || snapshot.treeSha256 !== plane.treeSha256 ||
          evidenceSha(JSON.stringify(snapshot.tree)) !== snapshot.treeSha256) throw Error('react-composition-source-plane-changed');
      const root = flatten(snapshot.tree).find(e => e.path === instance.roots[0]);
      if (!root) throw Error('react-composition-source-root-missing');
      const name = reactComparisonVariant(candidate.rootMatrix.draft.contract, instance.props);
      (styles[name] ??= []).push(root.node.style);
    }
    mains.push({ source: matrix.source, heldProps: matrix.heldProps, styles,
      contract: candidate.rootMatrix.draft.contract, input: observed.input, receipt: observed.receipt });
  }
  return { ...matchReactComposition(program, row.ownership, original.captured.tree, content, mains), content };
}
