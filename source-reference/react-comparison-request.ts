import { createHash } from 'node:crypto';
import { isReactNativeRequest, type ReactNativeRequest } from './react-native-request.js';
export interface ReactComparisonRequest {
  version: 1 | 2 | 3;
  mainRoot?: ReactNativeRequest;
  composition?: { revision: string };
  kind: 'react-content-comparison';
  parentOperationId: string;
  root: ReactNativeRequest;
  content: { id: string; reportSha256: string; inventorySha256: string };
}
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export function isReactComparisonRequest(v: unknown): v is ReactComparisonRequest {
  const r = v as ReactComparisonRequest;
  return !!r && ((r.version === 1 && Object.keys(r).sort().join(',') === 'content,kind,parentOperationId,root,version') ||
    (r.version === 3 && Object.keys(r).sort().join(',') === (r.composition ? 'composition,content,kind,mainRoot,parentOperationId,root,version' : 'content,kind,mainRoot,parentOperationId,root,version') &&
      isReactNativeRequest(r.mainRoot) && r.mainRoot.version === 1 && (!r.composition || (Object.keys(r.composition).join(',') === 'revision' && /^sha256:[a-f0-9]{64}$/.test(r.composition.revision)))) ||
    (r.version === 2 && Object.keys(r).sort().join(',') === 'composition,content,kind,parentOperationId,root,version' &&
      !!r.composition && Object.keys(r.composition).join(',') === 'revision' && /^sha256:[a-f0-9]{64}$/.test(r.composition.revision))) && r.kind === 'react-content-comparison' && typeof r.parentOperationId === 'string' && uuid.test(r.parentOperationId) &&
    isReactNativeRequest(r.root) && r.root.version === 1 && !!r.content && Object.keys(r.content).sort().join(',') === 'id,inventorySha256,reportSha256' &&
    typeof r.content.id === 'string' && uuid.test(r.content.id) && typeof r.content.inventorySha256 === 'string' && /^[a-f0-9]{64}$/.test(r.content.inventorySha256) && typeof r.content.reportSha256 === 'string' && /^[a-f0-9]{64}$/.test(r.content.reportSha256);
}
export function reactComparisonReservation(r: ReactComparisonRequest): string {
  if (!isReactComparisonRequest(r)) throw Error('react-comparison-request-invalid');
  const h = createHash('sha256').update(JSON.stringify(r.version === 3 ? ['react-content-comparison-v3', r.parentOperationId, r.root.caseId, r.composition?.revision ?? null] : r.version === 1 ? ['react-content-comparison', r.parentOperationId] : ['react-content-comparison-v2', r.parentOperationId, r.composition!.revision])).digest('hex').slice(0, 32);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

/** Per-case content preparation never replaces the original parent's pointer. */
export function reactComparisonContentScope(parentId: string, source: ReactNativeRequest): string {
  const h = createHash('sha256').update(JSON.stringify(['react-case-content', parentId, source])).digest('hex').slice(0, 32);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export function reactComparisonContentOperation(request: ReactComparisonRequest): string {
  return request.version === 3 ? reactComparisonContentScope(request.parentOperationId, request.root) : request.parentOperationId;
}
