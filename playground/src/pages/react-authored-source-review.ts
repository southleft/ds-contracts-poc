import type { ReactAuthoredSourceReview } from '../../../source-reference/react-authored-source-review';

export interface AuthoredSourceReviewIdentity {
  requestRevision: string;
  sourceImageSha256: string;
  treeSha256: string;
  frameInputSha256: string;
}
const hash = /^[a-f0-9]{64}$/;
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);

/** A new source observation or operation must never inherit another review. */
export function authoredSourceReviewScope(referenceId: string, row: {
  kind: string; operation: {id: string}; authoredSourceReviewIdentity?: AuthoredSourceReviewIdentity;
}): string | undefined {
  const identity = row.authoredSourceReviewIdentity;
  if (row.kind !== 'authored' || !identity || !/^sha256:[a-f0-9]{64}$/.test(identity.requestRevision) ||
      !hash.test(identity.sourceImageSha256) || !hash.test(identity.treeSha256) || !hash.test(identity.frameInputSha256)) return undefined;
  return JSON.stringify([referenceId, row.operation.id, identity.requestRevision, identity.sourceImageSha256, identity.treeSha256, identity.frameInputSha256]);
}

/** Host authentication owns the evidence; this check prevents a stale response
 * or malformed display payload from being paired with the current operation. */
export function authoredSourceReviewMatches(value: unknown, identity: AuthoredSourceReviewIdentity): value is ReactAuthoredSourceReview {
  if (!object(value) || value.qualification !== 'unqualified' || typeof value.id !== 'string' || !value.id ||
      value.requestRevision !== identity.requestRevision || value.sourceImageSha256 !== identity.sourceImageSha256 ||
      value.treeSha256 !== identity.treeSha256 || typeof value.image !== 'string' ||
      !/^data:image\/png;base64,iVBORw0KGgo[A-Za-z0-9+/]*={0,2}$/.test(value.image)) return false;
  const frame = value.frame;
  const box = (v: unknown) => object(v) && [v.x, v.y, v.width, v.height].every(Number.isFinite) &&
    v.x >= 0 && v.y >= 0 && v.width > 0 && v.height > 0;
  return object(frame) && frame.version === 1 && frame.qualification === 'unqualified' &&
    frame.sourceSha256 === identity.sourceImageSha256 && frame.inputSha256 === identity.frameInputSha256 &&
    typeof frame.imageSha256 === 'string' && hash.test(frame.imageSha256) && box(frame.bounds) && box(frame.crop) &&
    object(frame.sourceSize) && [frame.sourceSize.width, frame.sourceSize.height].every(v => Number.isInteger(v) && v > 0) &&
    [frame.crop.x, frame.crop.y, frame.crop.width, frame.crop.height].every(Number.isInteger) &&
    frame.crop.x + frame.crop.width <= frame.sourceSize.width && frame.crop.y + frame.crop.height <= frame.sourceSize.height;
}
