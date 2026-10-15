import assert from 'node:assert/strict';
import test from 'node:test';
import { authoredSourceReviewMatches, authoredSourceReviewScope } from './react-authored-source-review';

const identity = { requestRevision: 'sha256:' + 'a'.repeat(64), sourceImageSha256: 'b'.repeat(64), treeSha256: 'c'.repeat(64), frameInputSha256: 'd'.repeat(64) };
const row = {kind: 'authored', operation: {id: 'operation-one'}, authoredSourceReviewIdentity: identity};
const review = {
  id: 'review-one', ...identity, qualification: 'unqualified',
  image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+c2ioAAAAASUVORK5CYII=',
  frame: {version: 1, qualification: 'unqualified', sourceSha256: identity.sourceImageSha256,
    inputSha256: identity.frameInputSha256, imageSha256: 'e'.repeat(64), bounds: {x: 8.5, y: 8, width: 31.5, height: 20},
    crop: {x: 0, y: 0, width: 48, height: 36}, sourceSize: {width: 900, height: 600}},
};

test('only an identified authored-v1 row gets source review; other native paths remain excluded', () => {
  assert.ok(authoredSourceReviewScope('reference-one', row));
  for (const kind of ['root', 'family', 'comparison', 'initial', 'nested', 'state-api', 'authored-initial', 'authored-state-api'])
    assert.equal(authoredSourceReviewScope('reference-one', {...row, kind}), undefined, kind);
  assert.equal(authoredSourceReviewScope('reference-one', {...row, authoredSourceReviewIdentity: undefined}), undefined);
  assert.equal(authoredSourceReviewScope('reference-one', {...row, authoredSourceReviewIdentity: {...identity, requestRevision: 'not-a-revision'}}), undefined);
});

test('review scope changes for every source identity input, reference, and operation', () => {
  const scope = authoredSourceReviewScope('reference-one', row);
  assert.notEqual(authoredSourceReviewScope('reference-two', row), scope);
  assert.notEqual(authoredSourceReviewScope('reference-one', {...row, operation: {id: 'operation-two'}}), scope);
  for (const field of ['requestRevision', 'sourceImageSha256', 'treeSha256', 'frameInputSha256'] as const) {
    const changed = {...identity, [field]: field === 'requestRevision' ? 'sha256:' + 'f'.repeat(64) : 'f'.repeat(64)};
    assert.notEqual(authoredSourceReviewScope('reference-one', {...row, authoredSourceReviewIdentity: changed}), scope);
    assert.equal(authoredSourceReviewMatches(review, changed), false, `stale ${field}`);
  }
  assert.equal(authoredSourceReviewMatches(review, identity), true);
});

test('malformed image/framing and invented qualification cannot be displayed as a saved review', () => {
  for (const value of [null, {}, {...review, qualification: 'qualified'}, {...review, image: 'javascript:alert(1)'},
    {...review, image: 'data:image/png;base64,aGVsbG8='},
    {...review, frame: {...review.frame, sourceSha256: 'f'.repeat(64)}},
    {...review, frame: {...review.frame, inputSha256: 'f'.repeat(64)}},
    {...review, frame: {...review.frame, crop: {...review.frame.crop, width: 9000}}},
    {...review, frame: {...review.frame, bounds: {...review.frame.bounds, width: NaN}}}])
    assert.equal(authoredSourceReviewMatches(value, identity), false);
});
