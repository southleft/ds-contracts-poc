/** Token allocation provenance. A prepared library is retained contract data,
 * not an independently observed source program. The host must reopen its
 * artifact before deriving a plan; these hashes alone grant no write authority. */
export type NativeTokenSource = {
  kind?: undefined;
  revision: string;
  sourceProgramSha256: string;
  tokensSha256: string;
} | {
  kind: 'prepared-contract-library';
  revision: string;
  artifactId: string;
  inputSha256: string;
  tarballSha256: string;
  tokensSha256: string;
  sourceProgramSha256?: never;
};

export function isNativeTokenSource(value: unknown): value is NativeTokenSource {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
  if (!hash(source.tokensSha256)) return false;
  if (source.kind === 'prepared-contract-library') {
    return Object.keys(source).sort().join(',') === 'artifactId,inputSha256,kind,revision,tarballSha256,tokensSha256' &&
      hash(source.artifactId) && hash(source.inputSha256) && hash(source.tarballSha256) &&
      source.revision === `sha256:${source.artifactId}`;
  }
  // Preserve the existing source-program protocol and its historical bytes.
  return source.kind === undefined && typeof source.revision === 'string' &&
    source.revision.length > 0 && source.revision.trim() === source.revision && hash(source.sourceProgramSha256);
}
