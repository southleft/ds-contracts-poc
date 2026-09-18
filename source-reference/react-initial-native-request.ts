import { createHash } from 'node:crypto';
import { isReactNativeRequest, type ReactNativeRequest } from './react-native-request.js';
export type ReactInitialNativeRequest = {
  kind: 'react-initial-draft'; anchor: ReactNativeRequest; caseId: string;
  observation: { id: string; inventorySha256: string; reportSha256: string };
} & ({ version: 1 } | { version: 2; instanceId: string });
export function isReactInitialNativeRequest(value: unknown): value is ReactInitialNativeRequest {
  const r = value as ReactInitialNativeRequest;
  return !!r && ((r.version === 1 && Object.keys(r).sort().join(',') === 'anchor,caseId,kind,observation,version') ||
    (r.version === 2 && Object.keys(r).sort().join(',') === 'anchor,caseId,instanceId,kind,observation,version' &&
      typeof r.instanceId === 'string' && /^instance-\d+$/.test(r.instanceId))) &&
    r.kind === 'react-initial-draft' && isReactNativeRequest(r.anchor) && r.anchor.version === 1 &&
    typeof r.caseId === 'string' && /^[a-z][a-z-]{0,79}$/.test(r.caseId) && !!r.observation &&
    Object.keys(r.observation).sort().join(',') === 'id,inventorySha256,reportSha256' &&
    typeof r.observation.id === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(r.observation.id) &&
    [r.observation.inventorySha256, r.observation.reportSha256].every(v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v));
}
export function reactInitialNativeReservation(r: ReactInitialNativeRequest): string {
  if (!isReactInitialNativeRequest(r)) throw Error('react-initial-native-request-invalid');
  // A new observation cannot silently allocate a replacement for this source case.
  const h = createHash('sha256').update(JSON.stringify([r.kind, r.anchor.referenceId, r.anchor.ownership.id, r.caseId,
    ...(r.version === 2 ? [r.instanceId] : [])])).digest('hex').slice(0, 32);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
