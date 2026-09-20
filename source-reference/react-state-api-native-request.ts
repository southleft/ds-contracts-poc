import { createHash } from 'node:crypto';
import {
  isReactInitialNativeRequest,
  reactInitialNativeReservation,
  type ReactInitialNativeRequest,
} from './react-initial-native-request.js';
export interface ReactStateApiNativePin {
  key: string;
  id: string;
  inventorySha256: string;
  reportSha256: string;
}
export interface ReactStateApiNativeRequest {
  version: 1;
  kind: 'react-state-api-draft';
  initial: ReactInitialNativeRequest;
  observation: ReactStateApiNativePin;
}
export function isReactStateApiNativeRequest(
  value: unknown,
): value is ReactStateApiNativeRequest {
  const r = value as ReactStateApiNativeRequest,
    p = r?.observation;
  return (
    !!r &&
    Object.keys(r).sort().join(',') === 'initial,kind,observation,version' &&
    r.version === 1 &&
    r.kind === 'react-state-api-draft' &&
    isReactInitialNativeRequest(r.initial) &&
    r.initial.version === 1 &&
    !!p &&
    Object.keys(p).sort().join(',') === 'id,inventorySha256,key,reportSha256' &&
    typeof p.id === 'string' &&
    /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(p.id) &&
    [p.key, p.inventorySha256, p.reportSha256].every(
      (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v),
    )
  );
}
export function reactStateApiNativeReservation(
  r: ReactStateApiNativeRequest,
): string {
  if (!isReactStateApiNativeRequest(r))
    throw Error('react-state-api-native-request-invalid');
  const h = createHash('sha256')
    .update(JSON.stringify([r.kind, reactInitialNativeReservation(r.initial)]))
    .digest('hex')
    .slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
