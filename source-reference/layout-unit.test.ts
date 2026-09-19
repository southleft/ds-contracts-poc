import assert from 'node:assert/strict';
import test from 'node:test';
import { authoredLengthIsUsed, usedLayoutUnits } from './layout-unit.js';

test('an authored fractional length matches its 1/64 px layout-unit reading, and nothing looser', () => {
  assert.equal(authoredLengthIsUsed('18.4px', '18.3906px'), true); // 1177/64, six significant digits
  assert.equal(authoredLengthIsUsed('118.4px', '118.391px'), true); // 7577/64 = 118.390625
  assert.equal(authoredLengthIsUsed('32px', '32px'), true);
  assert.equal(authoredLengthIsUsed('rgb(1, 2, 3)', 'rgba(1, 2, 3, 1)'), true); // existing normalization is kept
  assert.equal(authoredLengthIsUsed('18.4px', '18.4063px'), false); // rounding up is not what layout does
  assert.equal(authoredLengthIsUsed('18.4px', '18.375px'), false); // one whole unit away
  assert.equal(authoredLengthIsUsed('18.4px', '18px'), false);
  assert.equal(authoredLengthIsUsed('1.15rem', '18.3906px'), false); // only px is an authored pixel length
  assert.equal(authoredLengthIsUsed('auto', '18.3906px'), false);
});

test('a used length reads as whole layout units only when it is the serialization of one', () => {
  assert.deepEqual(['32px', '18.3906px', '118.391px', '0px', '-8px', '0.5px'].map(usedLayoutUnits), [2048, 1177, 7577, 0, -512, 32]);
  assert.deepEqual(['18.4px', '18.39px', '0.01px', 'auto', '50%', 'calc(100% - 2px)', ''].map(usedLayoutUnits), Array(7).fill(undefined));
  assert.equal(usedLayoutUnits('32px')! - 2 * usedLayoutUnits('1px')! - usedLayoutUnits('16px')!, 14 * 64, 'box arithmetic is integer arithmetic');
});
