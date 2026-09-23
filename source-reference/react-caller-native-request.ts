import { createHash } from 'node:crypto';

export interface ReactCallerNativeRequest {
  version: 1;
  kind: 'react-caller-graph-draft';
  referenceId: string;
  parentOperationId: string;
  ownership: { id: string; sha256: string };
  inventorySha256: string;
  caseId: string;
  graphRevision: string;
  graphVerification?: 1;
}
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const hash = /^[a-f0-9]{64}$/;
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;

export function isReactCallerNativeRequest(value: unknown): value is ReactCallerNativeRequest {
  const request = value as ReactCallerNativeRequest;
  return object(request) && Object.keys(request).sort().join(',') ===
    (request.graphVerification === undefined
      ? 'caseId,graphRevision,inventorySha256,kind,ownership,parentOperationId,referenceId,version'
      : 'caseId,graphRevision,graphVerification,inventorySha256,kind,ownership,parentOperationId,referenceId,version') &&
    (request.graphVerification === undefined || request.graphVerification === 1) &&
    request.version === 1 && request.kind === 'react-caller-graph-draft' &&
    typeof request.referenceId === 'string' && hash.test(request.referenceId) &&
    typeof request.parentOperationId === 'string' && uuid.test(request.parentOperationId) &&
    typeof request.caseId === 'string' && /^[a-z][a-z-]{0,79}$/.test(request.caseId) &&
    typeof request.graphRevision === 'string' && /^sha256:[a-f0-9]{64}$/.test(request.graphRevision) &&
    typeof request.inventorySha256 === 'string' && hash.test(request.inventorySha256) &&
    object(request.ownership) && Object.keys(request.ownership).sort().join(',') === 'id,sha256' &&
    typeof request.ownership.id === 'string' && uuid.test(request.ownership.id) &&
    typeof request.ownership.sha256 === 'string' && hash.test(request.ownership.sha256);
}

/** One operation for the saved source composition. A changed graph cannot
 * allocate a second native graph behind the same parent evidence. */
export function reactCallerNativeReservation(request: ReactCallerNativeRequest) {
  if (!isReactCallerNativeRequest(request)) throw Error('react-caller-native-request-invalid');
  const digest = createHash('sha256').update(JSON.stringify([
    request.kind, request.referenceId, request.parentOperationId, request.ownership.id, request.caseId,
  ])).digest('hex').slice(0, 32);
  return `${digest.slice(0,8)}-${digest.slice(8,12)}-${digest.slice(12,16)}-${digest.slice(16,20)}-${digest.slice(20)}`;
}
