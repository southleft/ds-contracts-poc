import { canonicalJson, revisionOf } from '../../../core/contract-provenance.js';
import { parseLibraryRequest } from '../../server/react-library-input.js';
import type { Contract, TokenTreeInput } from '../../../core/index.js';

/** This is a data envelope, never a serialized host proof or projection verdict. */
export interface RetainedOccurrenceImport {
  kind: 'host-retained-occurrence';
  key: { fileKey: string; nodeId: string; canonicalJsonSha256: string };
  request: { rootId: string; contracts: Contract[]; tokens: TokenTreeInput; icons: Array<[string, string]> };
  selection: { kind: 'occurrence'; contractId: string; [key: string]: unknown };
  degradations: Array<{ code: string; nodePath: string; message: string }>;
  qualification: 'unqualified';
  acceptedContract: null;
}
const retainedByContract = new Map<string, RetainedOccurrenceImport>();

/** Only a registered host capture may open the occurrence door. Anonymous
 * captures refuse here; they never fall back to main-only proposals. */
export async function resolveRetainedOccurrence(dump: unknown, fetchImpl: typeof fetch = fetch): Promise<RetainedOccurrenceImport | null> {
  if (!dump || typeof dump !== 'object' || !('_occurrences' in dump)) return null;
  const roots = (dump as { _occurrences?: { roots?: Array<{ source?: { fileKey?: unknown; nodeId?: unknown } }> } })._occurrences?.roots;
  if (!Array.isArray(roots) || roots.length !== 1 || typeof roots[0].source?.fileKey !== 'string' || typeof roots[0].source?.nodeId !== 'string') throw Error('retained-occurrence-selection-required');
  const key = { fileKey: roots[0].source.fileKey, nodeId: roots[0].source.nodeId, canonicalJsonSha256: revisionOf(dump).slice('sha256:'.length) };
  const response = await fetchImpl('/api/react-library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'resolve-caller-occurrence', occurrence: key }) });
  const value = await response.json();
  if (!response.ok) throw Error(typeof value?.error === 'string' ? value.error : 'retained-occurrence-unavailable');
  if (value?.kind !== 'host-retained-occurrence' || canonicalJson(value.key) !== canonicalJson(key) || value.qualification !== 'unqualified' || value.acceptedContract !== null ||
    value.selection?.kind !== 'occurrence' || value.selection.contractId !== value.request?.rootId || !Array.isArray(value.degradations) ||
    value.degradations.some((d: Record<string, unknown>) => typeof d?.code !== 'string' || typeof d?.nodePath !== 'string' || typeof d?.message !== 'string')) throw Error('retained-occurrence-invalid-response');
  const input = parseLibraryRequest(value.request);
  if (input.root.bindings?.figma?.anchors?.fileKey !== key.fileKey || input.root.bindings?.figma?.anchors?.nodeId !== key.nodeId) throw Error('retained-occurrence-root-mismatch');
  const retained: RetainedOccurrenceImport = { ...value, request: { rootId: input.root.id, contracts: input.contracts, tokens: input.tokens, icons: input.icons } };
  return retained;
}

/** Commit only an import the UI has accepted after its revision and token checks.
 * Resolving or discarding a transport result must never alter this session cache.
 * This remains client session data; package authorization is reacquired on host. */
export function registerRetainedOccurrence(retained: RetainedOccurrenceImport): void {
  for (const contract of retained.request.contracts) retainedByContract.set(contract.id, retained);
}

/** Session data restores tokens and detects edits; package authority is always
 * reacquired from the host. No workspace/sessionStorage value can register it. */
export function retainedOccurrenceForContract(contract: Contract): RetainedOccurrenceImport | null {
  const retained = retainedByContract.get(contract.id);
  if (!retained) return null;
  const expected = retained.request.contracts.find(c => c.id === contract.id);
  if (canonicalJson(expected) !== canonicalJson(contract)) throw Error('retained-occurrence-contract-changed: reimport the retained capture');
  return retained;
}
export function retainedOccurrencePackageSelection(root: Contract, family: Map<string, Contract>, tokens: TokenTreeInput) {
  const retained = retainedOccurrenceForContract(root);
  if (!retained) return null;
  if (root.id !== retained.request.rootId) throw Error('retained-occurrence-select-root: prepare the imported occurrence root');
  for (const expected of retained.request.contracts) {
    if (canonicalJson(family.get(expected.id)) !== canonicalJson(expected)) throw Error('retained-occurrence-family-changed: reimport the retained capture');
  }
  if (canonicalJson(tokens) !== canonicalJson(retained.request.tokens)) throw Error('retained-occurrence-tokens-changed: reimport the retained capture');
  return { occurrence: retained.key };
}
