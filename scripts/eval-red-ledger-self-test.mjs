/**
 * PLANTED REDS FOR THE NAMED-RED LEDGER — `npm run eval-reds:self-test`
 *
 * The rule this proves: a red eval suite is permitted ONLY when every failing
 * eval is named, caused, and carries a stated closing condition. The gate that
 * enforces it was written to unblock a deadlock, so it is exactly the kind of
 * relaxation that must be exercised rather than trusted — an unexercised
 * escape hatch is how a standard quietly stops existing.
 */
import { evalRedFailures } from './eval-red-ledger.mjs';

const green = { passed: 2, total: 2, results: [{ id: 'a', pass: true }, { id: 'b', pass: true }] };
const red = { passed: 1, total: 2, results: [{ id: 'a', pass: true }, { id: 'b', pass: false }] };
const good = { reds: [{ id: 'b', cause: 'the canvas snapshot predates the fix', closesWhen: 're-minted from the current engine' }] };

const cases = [
  ['a GREEN suite passes whatever the ledger says', green, { reds: [{ id: 'zz' }] }, false],
  ['a RED suite with every red named, caused and closable PASSES', red, good, false],
  ['a RED suite with NO ledger file is REFUSED', red, null, /does not exist, so no red is named/],
  ['an UNNAMED red is REFUSED', red, { reds: [] }, /1 red\(s\) NOT named/],
  ['a ledger row whose eval now PASSES is REFUSED as stale', red, { reds: [good.reds[0], { id: 'a', cause: 'x', closesWhen: 'y' }] }, /name an eval that now PASSES/],
  ['a named red with NO cause is REFUSED', red, { reds: [{ id: 'b', cause: '  ', closesWhen: 'y' }] }, /no cause/],
  ['a named red with NO closesWhen is REFUSED', red, { reds: [{ id: 'b', cause: 'x', closesWhen: '' }] }, /no closesWhen/],
];

let failures = 0;
console.log('THE NAMED-RED LEDGER — planted reds\n');
for (const [name, results, ledger, expect] of cases) {
  const out = evalRedFailures(results, ledger, 'LEDGER');
  const msgs = out.map((f) => `${f.where}: ${f.msg}`);
  const ok = expect === false ? msgs.length === 0 : msgs.some((m) => expect.test(m));
  console.log(`  ${ok ? '✔' : '✖'} ${name}`);
  if (!ok) {
    failures++;
    console.log(`      expected ${expect === false ? 'NO refusal' : expect}; got: ${msgs.length ? msgs.join(' | ') : '(none)'}`);
  }
}
console.log(failures === 0 ? '\n✔ named-red ledger: 7 planted cases, all behave' : `\n✖ ${failures} planted case(s) did not behave`);
process.exit(failures === 0 ? 0 : 1);
