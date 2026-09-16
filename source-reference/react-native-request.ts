import { createHash } from 'node:crypto';

export interface ReactNativeRequest {
  version: 1;
  kind: 'react-root-draft';
  referenceId: string;
  ownership: { id: string; sha256: string };
  inventorySha256: string;
  caseId: string;
  matrixRevision: string;
}
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const hash = /^[a-f0-9]{64}$/;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export function isReactNativeRequest(v: unknown): v is ReactNativeRequest {
  return object(v) && Object.keys(v).sort().join(',') === 'caseId,inventorySha256,kind,matrixRevision,ownership,referenceId,version' &&
    v.version === 1 && v.kind === 'react-root-draft' && typeof v.referenceId === 'string' && hash.test(v.referenceId) &&
    typeof v.caseId === 'string' && /^[a-z][a-z-]{0,79}$/.test(v.caseId) &&
    typeof v.matrixRevision === 'string' && /^sha256:[a-f0-9]{64}$/.test(v.matrixRevision) &&
    typeof v.inventorySha256 === 'string' && hash.test(v.inventorySha256) &&
    object(v.ownership) && Object.keys(v.ownership).sort().join(',') === 'id,sha256' &&
    typeof v.ownership.id === 'string' && uuid.test(v.ownership.id) &&
    typeof v.ownership.sha256 === 'string' && hash.test(v.ownership.sha256);
}
/** One reservation per observed source case. A changed matrix/receipt cannot
 * allocate a replacement operation behind an existing journal's back. */
export function reactNativeReservation(request: ReactNativeRequest): string {
  if (!isReactNativeRequest(request)) throw Error('react-native-request-invalid');
  const h = createHash('sha256').update(JSON.stringify(['react-root-draft', request.referenceId,
    request.ownership.id, request.caseId])).digest('hex').slice(0, 32);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
