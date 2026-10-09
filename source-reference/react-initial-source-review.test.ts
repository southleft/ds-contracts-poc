import test from 'node:test';
import assert from 'node:assert/strict';
import { initialSourceReviewReason } from './react-initial-source-review.js';

test('source review exposes named capture refusals without private paths or tool output', () => {
  for (const message of ['react-initial-capture-pair-mismatch', 'transparent-source-frame-dependent-paint:filter'])
    assert.equal(initialSourceReviewReason(Error(message)), message);
  for (const message of ["ENOENT: no such file or directory, open '/private/source/report.json'",
    'react-initial-source-review-changed:/private/source', 'browser launch failed\nprivate log',
    'react-' + 'a'.repeat(200)])
    assert.equal(initialSourceReviewReason(Error(message)), 'react-initial-source-review-unavailable');
  assert.equal(initialSourceReviewReason({ message: 'react-valid-looking-error' }), 'react-initial-source-review-unavailable');
});
