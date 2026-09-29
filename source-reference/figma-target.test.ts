import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_REACT_FIGMA_FILE_KEY, parseFigmaFileKey, reactFigmaFileKey, validFigmaFileKey } from './figma-target.js';

const USER = 'NqssRZQpSjChxv5VyN1ZvJ';

test('a Figma link or bare key names the file; anything else is refused', () => {
  for (const value of [
    USER,
    `  ${USER}\n`,
    `https://www.figma.com/design/${USER}/DS-Contracts-Live-Testing?node-id=0-1&t=abc`,
    `https://figma.com/file/${USER}/Old-link`,
    `https://www.figma.com/proto/${USER}/Prototype`,
    `https://www.figma.com/design/${USER}`,
  ]) assert.equal(parseFigmaFileKey(value), USER, value);
  for (const value of [
    '', 'short', `https://example.com/design/${USER}/x`, `https://www.figma.com.evil.test/design/${USER}/x`,
    `https://www.figma.com/community/file/${USER}`, `https://www.figma.com/design/../${USER}`, `${USER}/extra`,
  ]) assert.throws(() => parseFigmaFileKey(value), /figma-target-file-invalid/, value);
  assert(validFigmaFileKey(USER));
  assert(!validFigmaFileKey(`${USER}/x`));
  assert(!validFigmaFileKey(42));
});

test('the configured file is the user\'s own, and the evaluation file only when none is set', () => {
  assert.equal(reactFigmaFileKey({}), DEFAULT_REACT_FIGMA_FILE_KEY);
  assert.equal(reactFigmaFileKey({ DS_CONTRACTS_FIGMA_FILE: '  ' }), DEFAULT_REACT_FIGMA_FILE_KEY);
  assert.equal(reactFigmaFileKey({ DS_CONTRACTS_FIGMA_FILE: `https://www.figma.com/design/${USER}/Live` }), USER);
  assert.throws(() => reactFigmaFileKey({ DS_CONTRACTS_FIGMA_FILE: 'not a file' }), /figma-target-file-invalid/,
    'a mistyped setting is refused, never replaced by the default file');
});
