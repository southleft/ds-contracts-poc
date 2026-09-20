import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveLoweringLines, deriveLoweringDocument } from './lowering-lines.js';
const fixture = () => ({ rules: [{ id: 'propose.sample', file: 'sample.ts', line: 1, ruleLine: 2, ruleText: 'return value;', why: 'preserved' }] });
test('citation moves preserve all recorded rule facts and do not mutate the input', () => {
  const before = fixture();
  const next = deriveLoweringLines(before, () => '\n\n// @lower propose.sample\nreturn value;\n');
  assert.deepEqual(next, { rules: [{ ...before.rules[0], line: 3, ruleLine: 4 }] });
  assert.equal(before.rules[0].line, 1);
});
test('changed, missing and ambiguous rules refuse instead of rewriting the recorded behavior', () => {
  for (const source of ['// @lower propose.sample\nreturn other;\n', 'return value;\n', '// @lower propose.sample\nreturn value;\n// @lower propose.sample\nreturn value;']) {
    assert.throws(() => deriveLoweringLines(fixture(), () => source), /lowering-/);
  }
  const unmarked = { rules: [{ id: 'emit.sample', file: 'runtime.ts', ruleLine: 1, ruleText: 'return value;' }] };
  assert.equal(deriveLoweringLines(unmarked, () => '\nreturn value;').rules[0].ruleLine, 2);
  assert.throws(() => deriveLoweringLines(unmarked, () => '\nreturn value;\nreturn value;'), /not-unique/);
});

test('a stale document refreshes against an already-current register and preserves rule prose', () => {
  const rules = fixture().rules;
  const stale = '# Rules\n| `propose.sample` | implemented | `sample.ts:99` | preserved wording |\nUnrelated `sample.ts:99` citation.\n';
  const expected = stale.replace('| `sample.ts:99` |', '| `sample.ts:2` |');
  const current = deriveLoweringDocument(stale, rules);
  assert.equal(current, expected);
  assert.equal(deriveLoweringDocument(current, rules), current);
});
