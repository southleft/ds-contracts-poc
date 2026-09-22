import { assertReactComparisonFamily } from './react-comparison-case.js';
import type { readReactCompositionEvidence } from './react-composition-evidence.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson, revisionOf } from '../core/contract-provenance.js';
import { evidenceSha } from './react-validation-evidence.js';
import { readReactContentInspection, readReactContentInspectionEvidence } from './react-content-inspection.js';
import type { ReactReference } from './react-reference.js';
import type { ReactNativeRequest } from './react-native-request.js';
import { isReactComparisonRequest, reactComparisonContentOperation, type ReactComparisonRequest } from './react-comparison-request.js';
import { recompileSavedObservedContent } from './observed-content.js';
import type { NativeContractObservationInput, NativeSourceReadback } from '../core/native-source-observation.js';
import { reactComparisonVariant } from './react-comparison-plan.js';
import {reactComparisonInstanceWidth,reactComparisonContainerWidth} from './react-comparison-context.js';
import { reactRootTextCallerEvidence } from './react-root-text-caller.js';

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
      canonicalJson(parent.request) !== canonicalJson(request.mainRoot ?? request.root)) throw Error('react-comparison-parent-changed');
  if (request.version === 3 || request.version === 4) assertReactComparisonFamily(repoRoot, reference, parent.request, request.root);
  const contentOperation = reactComparisonContentOperation(request);
  if (request.composition && (!composition || composition.review.status !== 'ready' || composition.review.inputRevision !== request.composition!.revision))
    throw Error('react-composition-pinned-mapping-changed');
  const inspected = readReactContentInspectionEvidence(repoRoot, reference, request.root, contentOperation,
    { id: request.content.id, inventorySha256: request.content.inventorySha256 });
  if (!inspected) throw Error('react-comparison-content-unavailable');
  const { original, report: saved } = inspected;
  if (saved.phase !== 'complete' || !saved.sourceUnchanged || saved.content?.status !== 'compiled-comparison-draft' || !original.observedProps)
    throw Error('react-comparison-content-unavailable');
  const dir = path.join(repoRoot, 'private/react-content-inspections', contentOperation, request.content.id);
  const read = (name: string) => JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
  if (evidenceSha(readFileSync(path.join(dir, 'report.json'))) !== request.content.reportSha256) throw Error('react-comparison-report-changed');
  const captured = read('source-tree.json');
  if (canonicalJson(captured.tree) !== canonicalJson(original.captured.tree)) throw Error('react-comparison-source-changed');
  // Composed requests authenticate a freshly compiled, ownership-aware content
  // plan through the pinned composition review above. The original flat
  // snapshot is not their rendered input (it includes children replaced by
  // linked mains); requiring it to recompile byte-identically would make an
  // unrelated compiler improvement invalidate an unchanged composed plan.
  const {content, sourceCompatibility} = request.composition
    ? { content: composition!.content, sourceCompatibility: undefined }
    : recompileSavedObservedContent(captured.tree, read('text-fonts.json'), read('svg-viewports.json'), saved.content);
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
  const origin=JSON.parse(readFileSync(originPath,'utf8')),instanceWidth=reactComparisonInstanceWidth(captured.tree,origin);
  // Only a fill-width main asks for its caller's place; any other root keeps
  // its own sizing and an own-100% case compares exactly as it always did.
  const containerWidth=variant.spec.rootFillWidth ? reactComparisonContainerWidth(captured.tree,origin) : undefined;
  return { ...(sourceCompatibility ? {sourceCompatibility} : {}), source: { ...original.source, evidenceRevision: revisionOf(request) }, content: request.composition ? composition!.content : content,
    comparison: { parent: parent.input, receipt: parent.receipt, caseId: request.root.caseId, variantName, slotSpecPath: paths[0],
      ...(parent.input.projection.rootTextTemplate ? { rootText: reactRootTextCallerEvidence(captured.tree, content) } : {}),
      ...(instanceWidth!==undefined ? {instanceWidth} : {}), ...(containerWidth!==undefined ? {containerWidth} : {}), ...(request.composition ? { instances: composition!.references } : {}) } };
}

/** Select only a new read-only mapping revision from the SAME archived input. */
export function refreshReactComparisonEvidence(repoRoot: string, reference: ReactReference, request: ReactComparisonRequest,
  parent: Parameters<typeof readReactComparisonEvidence>[3], composition?: ReturnType<typeof readReactCompositionEvidence>) {
  const selected = structuredClone(request);
  if (selected.composition && composition?.review.status === 'ready')
    selected.composition = { revision: composition.review.inputRevision };
  return { request: selected, evidence: readReactComparisonEvidence(repoRoot, reference, selected, parent, composition) };
}
