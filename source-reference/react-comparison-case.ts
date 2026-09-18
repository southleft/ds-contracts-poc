/** Reuse a verified native family only for an exactly identical archived root
 * matrix. Case labels and visual resemblance never establish equivalence. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalJson } from '../core/contract-provenance.js';
import { readReactNativeEvidence, selectReactNativeRequest } from './react-native-evidence.js';
import type { ReactNativeRequest } from './react-native-request.js';
import type { ReactReference } from './react-reference.js';

export function assertReactComparisonFamily(repo: string, reference: ReactReference,
  main: ReactNativeRequest, source: ReactNativeRequest) {
  if (main.version !== 1 || source.version !== 1 || main.referenceId !== source.referenceId ||
      canonicalJson(main.ownership) !== canonicalJson(source.ownership) || main.inventorySha256 !== source.inventorySha256)
    throw Error('react-comparison-family-archive-mismatch');
  const a = readReactNativeEvidence(repo, reference, main), b = readReactNativeEvidence(repo, reference, source);
  const report = JSON.parse(readFileSync(path.join(repo, 'private/react-source-ownership', main.referenceId, main.ownership.id, 'report.json'), 'utf8'));
  const row = (id: string) => report.rows.find((r: any) => r.id === id);
  const identity = (id: string) => row(id)?.ownership?.components.filter((c: any) => c.roots.includes('')).map((c: any) => c.source);
  const mainIdentity = identity(main.caseId), sourceIdentity = identity(source.caseId);
  if (mainIdentity?.length !== 1 || sourceIdentity?.length !== 1 || canonicalJson(mainIdentity) !== canonicalJson(sourceIdentity))
    throw Error('react-comparison-family-source-differs');
  const variantProps = new Set(a.matrix.draft?.contract?.props.map(prop => prop.bindings.code.prop));
  const held = (id: string) => Object.fromEntries(Object.entries(row(id)?.propertyMatrix?.heldProps ?? {})
    .filter(([key]) => key !== 'children' && !variantProps.has(key)));
  if (canonicalJson(held(main.caseId)) !== canonicalJson(held(source.caseId)))
    throw Error('react-comparison-family-held-inputs-differ');
  if (a.source.programSha256 !== b.source.programSha256 || canonicalJson(a.matrix) !== canonicalJson(b.matrix))
    throw Error('react-comparison-family-root-differs');
}

export function selectReactComparisonCase(repo: string, reference: ReactReference, main: ReactNativeRequest, caseId: string) {
  // Authenticate the complete archive before selecting another row from it.
  readReactNativeEvidence(repo, reference, main);
  const report = JSON.parse(readFileSync(path.join(repo, 'private/react-source-ownership', main.referenceId, main.ownership.id, 'report.json'), 'utf8'));
  const selected = selectReactNativeRequest(repo, report, caseId);
  assertReactComparisonFamily(repo, reference, main, selected);
  return selected;
}
