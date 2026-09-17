import type { readReactCompositionEvidence } from './react-composition-evidence.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { evidenceSha } from './react-validation-evidence.js';
import { readReactContentInspection, readReactContentInspectionEvidence } from './react-content-inspection.js';
import type { ReactReference } from './react-reference.js';
import type { ReactNativeRequest } from './react-native-request.js';
import { isReactComparisonRequest, type ReactComparisonRequest } from './react-comparison-request.js';
import { recompileSavedObservedContent } from './observed-content.js';
import type { NativeContractObservationInput, NativeSourceReadback } from '../core/native-source-observation.js';
import { reactComparisonVariant } from './react-comparison-plan.js';
import {reactComparisonInstanceWidth} from './react-comparison-context.js';

export function selectReactComparisonRequest(repoRoot: string, reference: ReactReference, root: ReactNativeRequest, parentOperationId: string, composition?: ReturnType<typeof readReactCompositionEvidence>): ReactComparisonRequest {
  const saved = readReactContentInspection(repoRoot, reference, root, parentOperationId);
  if (!saved || saved.phase !== 'complete' || !saved.sourceUnchanged || saved.content?.status !== 'compiled-comparison-draft')
    throw Error('react-comparison-content-unavailable');
  const dir = path.join(repoRoot, 'private/react-content-inspections', parentOperationId, saved.id);
  if (composition && composition.review.status !== 'ready') throw Error('react-composition-required-children-unresolved');
  return { ...(composition?.review.denominator ? { version: 2 as const, composition: { revision: composition.review.inputRevision } } : { version: 1 as const }), kind: 'react-content-comparison', parentOperationId, root: structuredClone(root), content: {
    id: saved.id, reportSha256: evidenceSha(readFileSync(path.join(dir, 'report.json'))),
    inventorySha256: evidenceSha(readFileSync(path.join(dir, 'integrity.json'))),
  } };
}
export function readReactComparisonEvidence(repoRoot: string, reference: ReactReference, request: ReactComparisonRequest,
  parent: { input: NativeContractObservationInput; receipt: NativeSourceReadback; request: ReactNativeRequest }, composition?: ReturnType<typeof readReactCompositionEvidence>) {
  if (!isReactComparisonRequest(request) || parent.input.operation.id !== request.parentOperationId ||
      canonicalJson(parent.request) !== canonicalJson(request.root)) throw Error('react-comparison-parent-changed');
  if (request.version === 2 && (!composition || composition.review.status !== 'ready' || composition.review.inputRevision !== request.composition!.revision))
    throw Error('react-composition-pinned-mapping-changed');
  const inspected = readReactContentInspectionEvidence(repoRoot, reference, request.root, request.parentOperationId,
    { id: request.content.id, inventorySha256: request.content.inventorySha256 });
  if (!inspected) throw Error('react-comparison-content-unavailable');
  const { original, report: saved } = inspected;
  if (saved.phase !== 'complete' || !saved.sourceUnchanged || saved.content?.status !== 'compiled-comparison-draft' || !original.observedProps)
    throw Error('react-comparison-content-unavailable');
  const dir = path.join(repoRoot, 'private/react-content-inspections', request.parentOperationId, request.content.id);
  const read = (name: string) => JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
  if (evidenceSha(readFileSync(path.join(dir, 'report.json'))) !== request.content.reportSha256) throw Error('react-comparison-report-changed');
  const captured = read('source-tree.json');
  if (canonicalJson(captured.tree) !== canonicalJson(original.captured.tree)) throw Error('react-comparison-source-changed');
  const {content, sourceCompatibility} = recompileSavedObservedContent(captured.tree, read('text-fonts.json'), read('svg-viewports.json'), saved.content);
  const contract = original.matrix.draft!.contract!;
  const variantName = reactComparisonVariant(contract, original.observedProps);
  const variant = parent.input.component.variants.find(v => v.name === variantName);
  if (!variant) throw Error('react-comparison-variant-unavailable');
  const paths: number[][] = [];
  const walk = (node: typeof variant.spec, path: number[]) => {
    if (node.type === 'slot' && node.rootSlotContent === true) paths.push(path);
    (node.children ?? []).forEach((child, i) => walk(child, [...path, i]));
  }; walk(variant.spec, []);
  if (paths.length !== 1) throw Error('react-comparison-root-slot-ambiguous');
  const originPath=path.join(repoRoot,'private/react-source-ownership',request.root.referenceId,request.root.ownership.id,request.root.caseId,'style-origin.json');
  // The original reader authenticated this inventory above. Pin the current
  // caller width into the comparison plan, leaving the main plan unchanged.
  const instanceWidth=reactComparisonInstanceWidth(captured.tree,JSON.parse(readFileSync(originPath,'utf8')));
  return { ...(sourceCompatibility ? {sourceCompatibility} : {}), source: { ...original.source, evidenceRevision: revisionOf(request) }, content: request.version === 2 ? composition!.content : content,
    comparison: { parent: parent.input, receipt: parent.receipt, caseId: request.root.caseId, variantName, slotSpecPath: paths[0],
      ...(instanceWidth!==undefined ? {instanceWidth} : {}), ...(request.version === 2 ? { instances: composition!.references } : {}) } };
}
