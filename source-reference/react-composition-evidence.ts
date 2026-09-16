/** Reopen sealed host evidence. No browser-provided paths or native IDs. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { evidenceSha } from './react-validation-evidence.js';
import { reactComparisonVariant } from './react-comparison-plan.js';
import { readReactNativeEvidence } from './react-native-evidence.js';
import { deriveReactChildRoot } from './react-child-root.js';
import { compileObservedContent, prepareObservedContentTree } from './observed-content.js';
import { matchReactComposition, type ReactCompositionMain } from './react-composition.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import type { ReactSourceProgram } from './react-source-program.js';
import type { ReactNativeRequest } from './react-native-request.js';
import type { ReactReference } from './react-reference.js';
import type { createNativeOperationJobs } from './native-operation-jobs.js';
import type { ReactPropertySnapshot } from './react-root-variants.js';
import { readReactContentInspectionEvidence } from './react-content-inspection.js';
import type { createReactInitialInspectionStore } from './react-initial-inspection.js';
import { flatten } from '../extract/computed/lib.js';

export function readReactCompositionEvidence(repo: string, reference: ReactReference, request: ReactNativeRequest,
  parentId: string, jobs: Pick<ReturnType<typeof createNativeOperationJobs>, 'listReact' | 'verifiedReactObservation' | 'verifiedReactInitialObservation'>,
  pinnedContent?: { id: string; inventorySha256: string },
  initialEvidence?: ReturnType<typeof createReactInitialInspectionStore>['nativeEvidence']) {
  const inspected = readReactContentInspectionEvidence(repo, reference, request, parentId, pinnedContent);
  if (!inspected || inspected.report.phase !== 'complete' || !inspected.report.sourceUnchanged ||
      inspected.report.content?.status !== 'compiled-comparison-draft') throw Error('react-composition-content-unavailable');
  const { original, report: saved } = inspected;
  const dir = path.join(repo, 'private/react-source-ownership', request.referenceId, request.ownership.id);
  // The original reader already authenticated every file in this inventory.
  const report = JSON.parse(readFileSync(path.join(dir, 'report.json'), 'utf8')) as ReactOwnershipReport;
  const row = report.rows.find(r => r.id === request.caseId)!;
  const program = JSON.parse(readFileSync(path.join(dir, 'program.json'), 'utf8')) as ReactSourceProgram;
  if (!row.ownership) throw Error('react-composition-ownership-unavailable');
  const contentDir = path.join(repo, 'private/react-content-inspections', parentId, saved.id);
  const read = (name: string) => JSON.parse(readFileSync(path.join(contentDir, name), 'utf8'));
  const sourceNodes = new Map(flatten(original.captured.tree).map(n => [n.path, n.node]));
  // Keep each source-owned flex or text-only block box independently
  // addressable. This preserves observed content, not a public children API.
  const boundaries = row.ownership.components.flatMap(c => c.roots).filter(p => p !== '' &&
    (['flex', 'inline-flex'].includes(sourceNodes.get(p)?.style.display ?? '') ||
      (sourceNodes.get(p)?.style.display === 'block' && sourceNodes.get(p)!.nodes.every(node => node.t === 'text'))));
  const content = compileObservedContent(original.captured.tree, read('text-fonts.json'), read('svg-viewports.json'), true,
    [...new Set(boundaries)].sort());
  const mains: ReactCompositionMain[] = [];
  const staleInitialSources: ReactCompositionMain['source'][] = [];
  const sources = row.ownership.components.filter(c => !c.roots.includes('')).map(c => JSON.stringify(c.source));
  // A leaf has no native dependencies to join. Its own archive and content
  // were authenticated above; unrelated native operations cannot affect it.
  if (!sources.length) return { ...matchReactComposition(program, row.ownership, original.captured.tree, content, mains), content, inspection: saved, inspectionSelection: inspected.selection };
  const operations = jobs.listReact(reference.id, 'mains').sort((a, b) => a.operation.id.localeCompare(b.operation.id));
  for (const operation of operations) {
    if (!['root', 'nested', 'initial'].includes(operation.kind) || operation.operation.id === parentId ||
        operation.ownershipId !== request.ownership.id || operation.operation.phase !== 'component-structure-observed') continue;
    const candidate = report.rows.find(r => r.id === operation.caseId);
    if (operation.kind === 'initial') {
      if (!initialEvidence) continue;
      let observed;
      try { observed = jobs.verifiedReactInitialObservation(operation.operation.id); } catch {
        const source = candidate?.ownership?.components.find(c => c.roots.includes(''))?.source;
        if (source) staleInitialSources.push(source);
        continue;
      }
      if (observed.request.anchor.ownership.sha256 !== request.ownership.sha256 ||
          observed.request.anchor.inventorySha256 !== request.inventorySha256)
        throw Error('react-composition-candidate-archive-changed');
      const selected = initialEvidence(reference, observed.request);
      if (!sources.includes(JSON.stringify(selected.composition.source))) continue;
      mains.push({ source: selected.composition.source, heldProps: selected.composition.heldProps,
        sourceOwnedTrees: selected.composition.trees, styles: {}, contract: selected.draft.compiled!.contract!,
        input: observed.input, receipt: observed.receipt });
      continue;
    }
    if (operation.kind === 'nested') {
      // The verifier can return a separately authenticated, completed update.
      // A stale creation plan alone is never enough to admit this candidate.
      let observed;
      try { observed = jobs.verifiedReactObservation(operation.operation.id); } catch { continue; }
      if (observed.request.ownership.sha256 !== request.ownership.sha256 || observed.request.inventorySha256 !== request.inventorySha256)
        throw Error('react-composition-candidate-archive-changed');
      const selected = readReactNativeEvidence(repo, reference, observed.request).matrix;
      if (selected.qualification !== 'observed-child-root-draft' || !sources.includes(JSON.stringify(selected.draft.source))) continue;
      const captured = JSON.parse(readFileSync(path.join(dir, operation.caseId, 'source-tree.json'), 'utf8'));
      const instance = candidate!.ownership!.components.find(c => c.id === selected.instanceId)!;
      const sourceRoot = flatten(captured.tree).find(n => n.path === instance.roots[0])!;
      mains.push({ source: selected.draft.source, heldProps: selected.heldProps, contract: selected.draft.contract!,
        sourceSizing: selected.draft.sourceSizing,
        styles: { [selected.draft.contract!.name]: [sourceRoot.node.style] }, input: observed.input, receipt: observed.receipt });
      continue;
    }
    if (!candidate?.propertyMatrix || !candidate.rootMatrix?.draft?.contract ||
        !sources.includes(JSON.stringify(candidate.propertyMatrix.source))) continue;
    let observed;
    try { observed = jobs.verifiedReactObservation(operation.operation.id); } catch { continue; }
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
  const result = matchReactComposition(program, row.ownership, original.captured.tree, content, mains,
    prepareObservedContentTree(original.captured.tree, read('text-fonts.json'), read('svg-viewports.json')));
  for (const row of result.review.rows) if (row.problems.includes('react-composition-main-not-verified') &&
      staleInitialSources.some(source => source.module === row.module && source.exportName === row.exportName))
    row.problems = row.problems.map(problem => problem === 'react-composition-main-not-verified'
      ? 'react-composition-initial-main-observation-stale' : problem);
  const origin = JSON.parse(readFileSync(path.join(dir, request.caseId, 'style-origin.json'), 'utf8'));
  for (const child of result.review.rows) {
    child.canPrepareMain = false;
    if (!child.problems.some(problem => [
      'react-composition-main-not-verified', 'react-composition-held-inputs-differ',
      'react-composition-observed-root-context-differs', 'react-composition-context-main-not-verified',
      'react-comparison-variant-value-unqualified', 'react-comparison-variant-omission-unqualified',
    ].includes(problem)) || operations.some(op =>
      op.kind === 'nested' && op.caseId === request.caseId && op.ownershipId === request.ownership.id && op.nestedInstanceId === child.instanceId)) continue;
    try { deriveReactChildRoot(program, row.ownership, original.captured.tree, origin, child.instanceId,
      saved.gridConstraints?.status==='observed' ? {gridConstraints:saved.gridConstraints} : undefined); child.canPrepareMain = true; }
    catch (error) { child.preparationProblem = error instanceof Error ? error.message : String(error); }
  }
  return { ...result, content, inspection: saved, inspectionSelection: inspected.selection };
}
