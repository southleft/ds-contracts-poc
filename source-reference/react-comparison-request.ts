import { createHash } from 'node:crypto';
import { isReactNativeRequest, type ReactNativeRequest } from './react-native-request.js';
export interface ReactComparisonRequest {
  version: 1;
  kind: 'react-content-comparison';
  parentOperationId: string;
  root: ReactNativeRequest;
  content: { id: string; reportSha256: string; inventorySha256: string };
}
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export function isReactComparisonRequest(v: unknown): v is ReactComparisonRequest {
  const r = v as ReactComparisonRequest;
  return !!r && Object.keys(r).sort().join(',') === 'content,kind,parentOperationId,root,version' &&
    r.version === 1 && r.kind === 'react-content-comparison' && typeof r.parentOperationId === 'string' && uuid.test(r.parentOperationId) &&
    isReactNativeRequest(r.root) && !!r.content && Object.keys(r.content).sort().join(',') === 'id,inventorySha256,reportSha256' &&
    typeof r.content.id === 'string' && uuid.test(r.content.id) && typeof r.content.inventorySha256 === 'string' && /^[a-f0-9]{64}$/.test(r.content.inventorySha256) && typeof r.content.reportSha256 === 'string' && /^[a-f0-9]{64}$/.test(r.content.reportSha256);
}
export function reactComparisonReservation(r: ReactComparisonRequest): string {
  if (!isReactComparisonRequest(r)) throw Error('react-comparison-request-invalid');
  const h = createHash('sha256').update(JSON.stringify(['react-content-comparison', r.parentOperationId])).digest('hex').slice(0, 32);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
