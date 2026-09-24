import {createHash} from 'node:crypto';

/** Retained library input, never a claim of observed React source. The host
 * chooses the writable file, operation identity and executable programs. */
export interface PreparedLibraryNativeRequest {
  version: 1;
  kind: 'prepared-library-native';
  artifactId: string;
  mode: 'light' | 'dark';
  brand: string;
}
export function isPreparedLibraryNativeRequest(value: unknown): value is PreparedLibraryNativeRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as PreparedLibraryNativeRequest;
  return Object.keys(r).sort().join(',') === 'artifactId,brand,kind,mode,version' &&
    r.version === 1 && r.kind === 'prepared-library-native' &&
    typeof r.artifactId === 'string' && /^[a-f0-9]{64}$/.test(r.artifactId) &&
    (r.mode === 'light' || r.mode === 'dark') && typeof r.brand === 'string' &&
    /^[a-z0-9][a-z0-9-]*$/.test(r.brand);
}
/** A repeated selection resumes its existing operation, including an unknown
 * native outcome. A mode/brand change is an explicit separate selection. */
export function preparedLibraryNativeReservation(request: PreparedLibraryNativeRequest) {
  if (!isPreparedLibraryNativeRequest(request)) throw Error('prepared-library-native-request-invalid');
  const digest = createHash('sha256').update(JSON.stringify([
    request.kind, request.artifactId, request.mode, request.brand,
  ])).digest('hex').slice(0, 32);
  return `${digest.slice(0,8)}-${digest.slice(8,12)}-${digest.slice(12,16)}-${digest.slice(16,20)}-${digest.slice(20)}`;
}
