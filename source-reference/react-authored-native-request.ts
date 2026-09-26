import {createHash} from 'node:crypto';
import {isReactStateApiNativePin,type ReactStateApiNativePin} from './react-state-api-native-request.js';

/** Host selection only. The browser supplies a case, never a draft or path. */
export interface ReactAuthoredNativeRequest {
  version: 1;
  kind: 'react-authored-draft';
  referenceId: string;
  caseId: string;
  ownership: {id: string; sha256: string};
  inventorySha256: string;
  helper: number;
  draftRevision: string;
}
/** Separate identity for a complete finite initial-input observation. */
export interface ReactAuthoredInitialNativeRequest extends Omit<ReactAuthoredNativeRequest, 'version'> {
  version: 2;
  initial: {
    key: string; id: string; inventorySha256: string; reportSha256: string;
    instanceId: string; anchorDraftRevision: string;
  };
}
/** A separate state experiment grants behavior authority over this exact graph. */
export interface ReactAuthoredStateApiNativeRequest extends Omit<ReactAuthoredInitialNativeRequest, 'version'> {
  version: 3;
  initialDraftRevision: string;
  stateApi: ReactStateApiNativePin;
}
export type ReactAuthoredOperationRequest = ReactAuthoredNativeRequest | ReactAuthoredInitialNativeRequest | ReactAuthoredStateApiNativeRequest;
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const hash = /^[a-f0-9]{64}$/;
export function isReactAuthoredNativeRequest(v: unknown): v is ReactAuthoredNativeRequest {
  return object(v) && Object.keys(v).sort().join(',') === 'caseId,draftRevision,helper,inventorySha256,kind,ownership,referenceId,version' &&
    v.version === 1 && v.kind === 'react-authored-draft' &&
    typeof v.referenceId === 'string' && hash.test(v.referenceId) &&
    typeof v.caseId === 'string' && /^[a-z][a-z-]{0,79}$/.test(v.caseId) &&
    typeof v.inventorySha256 === 'string' && hash.test(v.inventorySha256) &&
    typeof v.draftRevision === 'string' && /^sha256:[a-f0-9]{64}$/.test(v.draftRevision) &&
    Number.isSafeInteger(v.helper) && v.helper >= 0 &&
    object(v.ownership) && Object.keys(v.ownership).sort().join(',') === 'id,sha256' &&
    typeof v.ownership.id === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v.ownership.id) &&
    typeof v.ownership.sha256 === 'string' && hash.test(v.ownership.sha256);
}
export function reactAuthoredOwnershipAnchor(request: ReactAuthoredOperationRequest): ReactAuthoredNativeRequest {
  if (request.version === 1) return structuredClone(request);
  if (request.version === 3) return reactAuthoredOwnershipAnchor(reactAuthoredInitialAnchor(request));
  const {initial, ...base} = request;
  return {...base, version: 1, draftRevision: initial.anchorDraftRevision};
}
export function reactAuthoredInitialAnchor(request: ReactAuthoredInitialNativeRequest | ReactAuthoredStateApiNativeRequest): ReactAuthoredInitialNativeRequest {
  if (request.version === 2) return structuredClone(request);
  const {stateApi: _stateApi, initialDraftRevision, ...base} = request;
  return {...base,version:2,draftRevision:initialDraftRevision};
}
export function isReactAuthoredOperationRequest(v: unknown): v is ReactAuthoredOperationRequest {
  if (isReactAuthoredNativeRequest(v)) return true;
  if (object(v) && v.version === 3) return Object.keys(v).sort().join(',') ===
    'caseId,draftRevision,helper,initial,initialDraftRevision,inventorySha256,kind,ownership,referenceId,stateApi,version' &&
    typeof v.draftRevision === 'string' && /^sha256:[a-f0-9]{64}$/.test(v.draftRevision) &&
    isReactStateApiNativePin(v.stateApi) && isReactAuthoredOperationRequest(reactAuthoredInitialAnchor(v as ReactAuthoredStateApiNativeRequest));
  if (!object(v) || v.version !== 2 || Object.keys(v).sort().join(',') !==
      'caseId,draftRevision,helper,initial,inventorySha256,kind,ownership,referenceId,version' ||
      typeof v.draftRevision !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(v.draftRevision) || !object(v.initial)) return false;
  const pin = v.initial;
  return Object.keys(pin).sort().join(',') === 'anchorDraftRevision,id,instanceId,inventorySha256,key,reportSha256' &&
    ['key','inventorySha256','reportSha256'].every(k => typeof pin[k] === 'string' && hash.test(pin[k])) &&
    typeof pin.id === 'string' && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(pin.id) &&
    typeof pin.instanceId === 'string' && /^instance-\d+$/.test(pin.instanceId) &&
    isReactAuthoredNativeRequest(reactAuthoredOwnershipAnchor(v as ReactAuthoredInitialNativeRequest));
}
/** Changed bytes under the same observation cannot allocate a second graph. */
export function reactAuthoredNativeReservation(request: ReactAuthoredOperationRequest) {
  if (!isReactAuthoredOperationRequest(request)) throw Error('react-authored-native-request-invalid');
  const digest = createHash('sha256').update(JSON.stringify([
    request.kind, request.referenceId, request.ownership.id, request.caseId, request.helper,
    ...(request.version !== 1 ? ['initial', request.initial.key, request.initial.id] : []),
    ...(request.version === 3 ? ['state-api',request.stateApi.key,request.stateApi.id] : []),
  ])).digest('hex').slice(0,32);
  return [digest.slice(0,8),digest.slice(8,12),digest.slice(12,16),digest.slice(16,20),digest.slice(20)].join('-');
}
