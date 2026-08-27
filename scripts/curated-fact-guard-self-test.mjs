/**
 * PLANTED CASES FOR THE CURATED-FACT GUARD — `npm run curated-facts:self-test`
 *
 * The five REAL losses of 2026-08-26 are the first five cases. If a future
 * change to this classifier stops catching them, that change is wrong: those
 * are not hypotheticals, they are what actually shipped and what every other
 * gate in the tree read as an improvement.
 */
import { curatedFactLosses } from './curated-fact-guard.mjs';

const cases = [];
const c = (name, committed, produced, expect) => cases.push({ name, committed, produced, expect });

// ---- the five that actually happened ----
c('avatar.initials "TP" -> null is a LOSS', { initials: 'TP' }, { initials: null }, ['nulled:initials']);
c('avatar.withInitials true -> false is a LOSS (the zero value, not an absence)', { withInitials: true }, { withInitials: false }, ['defaulted:withInitials']);
c('progress-bar.progress 40 -> 0 is a LOSS', { progress: 40 }, { progress: 0 }, ['defaulted:progress']);
c('text-field.placeholder "Example" -> null is a LOSS', { placeholder: 'Example' }, { placeholder: null }, ['nulled:placeholder']);
c('thumbnail losing two radius bindings is a LOSS at each path',
  { bindings: { borderTopLeftRadius: 'r.sm', borderTopRightRadius: 'r.sm' } },
  { bindings: {} },
  ['dropped:bindings.borderTopLeftRadius', 'dropped:bindings.borderTopRightRadius']);

// ---- what must NOT trip it ----
c('an unchanged contract has no losses', { a: 1, b: { c: 'x' } }, { a: 1, b: { c: 'x' } }, []);
c('an ADDITION is not a loss', { a: 1 }, { a: 1, b: 2 }, []);
c('a value CHANGE between two real values is not a loss', { size: 'md' }, { size: 'lg' }, []);
c('0 -> 40 (a fact GAINED) is not a loss', { progress: 0 }, { progress: 40 }, []);
c('false -> true is not a loss', { on: false }, { on: true }, []);
c('key order does not matter', { a: 1, b: 2 }, { b: 2, a: 1 }, []);
c('a non-empty array emptied is a LOSS', { parts: ['root', 'label'] }, { parts: [] }, ['emptied:parts']);
c('an object replaced by null is a LOSS', { anatomy: { root: {} } }, { anatomy: null }, ['nulled:anatomy']);
c('a nested scalar dropped is a LOSS at its full path', { a: { b: { c: 'keep' } } }, { a: { b: {} } }, ['dropped:a.b.c']);
c('empty string -> empty string is not a loss', { s: '' }, { s: '' }, []);

let failures = 0;
console.log('THE CURATED-FACT GUARD — planted cases\n');
for (const { name, committed, produced, expect } of cases) {
  const { losses } = curatedFactLosses(committed, produced);
  const got = losses.map((l) => `${l.kind}:${l.path}`).sort();
  const want = [...expect].sort();
  const ok = got.length === want.length && got.every((g, i) => g === want[i]);
  console.log(`  ${ok ? '✔' : '✖'} ${name}`);
  if (!ok) {
    failures++;
    console.log(`      expected [${want.join(', ')}]; got [${got.join(', ')}]`);
  }
}
console.log(failures === 0 ? `\n✔ curated-fact guard: ${cases.length} planted cases, all behave` : `\n✖ ${failures} planted case(s) did not behave`);
process.exit(failures === 0 ? 0 : 1);
