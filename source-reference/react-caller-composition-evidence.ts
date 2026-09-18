import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readReactContentInspectionEvidence } from './react-content-inspection.js';
import { projectReactCallerCompositionGraph, type ReactCallerBehavior } from './react-caller-composition.js';
import type { ReactReference } from './react-reference.js';
import type { ReactNativeRequest } from './react-native-request.js';
import type { ReactOwnershipReport } from './react-ownership-run.js';
import type { ReactSourceProgram } from './react-source-program.js';

/** All locations come from the host-owned request and sealed inventories.
 * No posted contract, source code or native identity can enter this reader. */
export function readReactCallerComposition(repo: string, reference: ReactReference, request: ReactNativeRequest,
  operationId: string, behavior: (caseId: string, instanceId?: string) => ReactCallerBehavior | undefined) {
  return readReactCallerCompositionGraph(repo, reference, request, operationId, behavior).draft;
}
export function readReactCallerCompositionGraph(repo: string, reference: ReactReference, request: ReactNativeRequest,
  operationId: string, behavior: (caseId: string, instanceId?: string) => ReactCallerBehavior | undefined) {
  const inspected = readReactContentInspectionEvidence(repo, reference, request, operationId);
  if (!inspected || inspected.report.phase !== 'complete' || !inspected.report.sourceUnchanged ||
      inspected.report.problems.length || !inspected.report.labelAssociations)
    throw Error('react-caller-content-observation-required');
  const archive = path.join(repo, 'private/react-source-ownership', reference.id, request.ownership.id);
  const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
  const report = read(path.join(archive, 'report.json')) as ReactOwnershipReport;
  const row = report.rows.find(r => r.id === request.caseId);
  if (!row?.ownership) throw Error('react-caller-source-ownership-unavailable');
  const program = read(path.join(archive, 'program.json')) as ReactSourceProgram;
  const childSources = new Set(row.ownership.components.filter(c => !c.roots.includes('')).map(c => JSON.stringify(c.source)));
  const candidates = report.rows.filter(r => r.ownership?.components.some(c => c.roots.includes('') && childSources.has(JSON.stringify(c.source))));
  const behaviors: ReactCallerBehavior[] = [];
  for (const child of row.ownership.components.filter(c => c.parent && !c.roots.includes(''))) {
    try { const value = behavior(request.caseId, child.id); if (value) behaviors.push(value); } catch { /* Missing contextual observations cannot qualify this child. */ }
  }
  for (const candidate of candidates) {
    // Missing initial/behavior observations cannot authorize a child. The
    // projector reports the unresolved identity; never launch a hidden read.
    try { const value = behavior(candidate.id); if (value) behaviors.push(value); } catch { /* Unavailable evidence is not a candidate. */ }
  }
  const content = path.join(repo, 'private/react-content-inspections', operationId, inspected.selection.id);
  return projectReactCallerCompositionGraph({ program, ownership: row.ownership, tree: inspected.original.captured.tree,
    origin: read(path.join(archive, request.caseId, 'style-origin.json')), fonts: read(path.join(content, 'text-fonts.json')),
    svg: read(path.join(content, 'svg-viewports.json')), grids: inspected.report.gridConstraints,
    labels: inspected.report.labelAssociations, behaviors });
}
