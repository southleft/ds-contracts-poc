import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fidelityCounts, v1DocClaimFailures, v1ExamClaimFailures, radixReadmeClaimFailures } from './v1-doc-claims.mjs';

const scorecard = { subjects: 3, passed: 2, fringeExcused: 0, failed: 1, knownFailures: 1, rows: [
  { label: 'a', status: 'pass' }, { label: 'b', status: 'pass' }, { label: 'c', status: 'fail' },
] };
const known = { failures: { c: { class: 'font-substrate' } } };
const documents = {
  'docs/26-v1-definition.md': '> fidelity gate 2 pass · 0 fringe ·\n> 1 named',
  'docs/37-product-repo-manifest.md': '**The 1 `KNOWN-FAILURES` rows** move',
  'parity/receipts/v1/WHAT-YOU-CAN-DO-TODAY.md': '2 of 3 fidelity rows\n# 2 pass · 0 fringe · 1 named',
};
test('current prose passes only when all fidelity populations agree', () => {
  assert.deepEqual(fidelityCounts(scorecard, known), { passed: 2, fringe: 0, named: 1, total: 3 });
  assert.deepEqual(v1DocClaimFailures(documents, fidelityCounts(scorecard, known)), []);
});
test('stale pass, named, and population counts fail; missing prose cannot silently escape', () => {
  const counts = fidelityCounts(scorecard, known);
  for (const [file, from, to] of [
    ['docs/26-v1-definition.md', '2 pass', '53 pass'],
    ['docs/26-v1-definition.md', '1 named', '12 named'],
    ['docs/37-product-repo-manifest.md', 'The 1', 'The eight'],
    ['parity/receipts/v1/WHAT-YOU-CAN-DO-TODAY.md', 'of 3', 'of 66'],
  ]) {
    assert.ok(v1DocClaimFailures({ ...documents, [file]: documents[file].replace(from, to) }, counts).some((f) => f.startsWith(file)));
  }
  assert.ok(v1DocClaimFailures({}, counts).every((f) => f.includes('missing current')));
});
test('tampered source tallies and stale known-failure entries fail before prose is trusted', () => {
  assert.throws(() => fidelityCounts({ ...scorecard, passed: 3 }, known), /summary disagrees/);
  assert.throws(() => fidelityCounts(scorecard, { failures: { a: {} } }), /no longer fails/);
  assert.throws(() => fidelityCounts({ ...scorecard, rows: [scorecard.rows[0], scorecard.rows[0], scorecard.rows[2]] }, known), /duplicate labels/);
});
test('exam prose rejects stale calendar scores and designer counts without grading', () => {
  const f1 = { rows: { calendar: { pctAAMasked: 3.048 } } };
  const designer = { subjects: [{ outcome: 'accounting-zero-silent', silent: 0, unexplained: 0 }, { outcome: 'refused-by-name', refusal: { message: 'named refusal' } }] };
  const readme = 'scored at **3.048%**; scored against the real package\'s Chromium render at **3.048%**; 1 accounting-clean, 1 refused by name';
  assert.deepEqual(v1ExamClaimFailures({ 'README.md': readme }, f1, designer), []);
  assert.match(v1ExamClaimFailures({ 'README.md': readme.replace('3.048', '3.735') }, f1, designer).join('\n'), /current calendar score/);
  assert.match(v1ExamClaimFailures({ 'README.md': readme.replace('1 accounting-clean', '2 accounting-clean') }, f1, designer).join('\n'), /designer exam counts/);
  assert.throws(() => v1ExamClaimFailures({}, f1, { subjects: [{ outcome: 'accounting-zero-silent', silent: 1, unexplained: 0 }] }), /unaccounted/);
});

test('README current Radix status cannot keep a mint refusal after successful measurement', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const f1 = JSON.parse(readFileSync(new URL('../recipe/evidence/f1-v1/receipt.json', import.meta.url), 'utf8'));
  assert.equal(f1.rows.radix.archetypes.find((a) => a.archetype === 'checkbox').outcome, 'scored');
  assert.deepEqual(radixReadmeClaimFailures(readme, f1), []);
  const normalized = readme.replace(/\*\*/g, '');
  assert.ok(radixReadmeClaimFailures(normalized.replace('0.39', '8.39'), f1).some((p) => p.includes('checkbox scores')));
  assert.ok(radixReadmeClaimFailures(normalized.replace('2 archetypes refuse', '3 archetypes refuse'), f1).some((p) => p.includes('role refusal count')));
  assert.ok(radixReadmeClaimFailures('', f1).length > 0);
});
