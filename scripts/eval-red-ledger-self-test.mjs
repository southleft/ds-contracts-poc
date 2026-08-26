/**
 * PLANTED REDS FOR THE NAMED-RED LEDGER — `npm run eval-reds:self-test`
 *
 * The rule this proves: a red eval suite is permitted ONLY when every failing
 * eval is named, caused, and carries a stated closing condition. The gate that
 * enforces it was written to unblock a deadlock, so it is exactly the kind of
 * relaxation that must be exercised rather than trusted — an unexercised
 * escape hatch is how a standard quietly stops existing.
 */
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { evalRedFailures } from './eval-red-ledger.mjs';
import { compareFailures } from './eval-record-check.mjs';

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

// THE WIRING, not just the rule. eval:record:check consults the same ledger,
// and it reads CI's MEASURED reds rather than the committed record's — so
// naming a comfortable red while CI fails a different one must still refuse.
// A call site proved once by hand is a call site that rots.
{
  const REC = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'evals/results.json');
  const LED = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'parity/receipts/v1/eval-reds.json');
  const recBak = readFileSync(REC, 'utf8');
  const ledBak = readFileSync(LED, 'utf8');
  const dir = mkdtempSync(path.join(tmpdir(), 'evalred-'));
  const measuredPath = path.join(dir, 'measured.json');
  try {
    const rec = JSON.parse(recBak);
    rec.results[0].pass = false;
    rec.passed = rec.total - 1;
    const redId = rec.results[0].id;
    writeFileSync(REC, JSON.stringify(rec, null, 2));
    writeFileSync(measuredPath, JSON.stringify(rec, null, 2));
    const led = JSON.parse(ledBak);

    const wiring = [
      ['eval:record:check REFUSES a red CI measurement with no ledger row', [], true],
      ['eval:record:check PASSES when CI\'s measured red is named', [{ id: redId, cause: 'planted', closesWhen: 'the self-test restores the record' }], false],
      ['eval:record:check REFUSES when the ledger names a DIFFERENT red than CI measured', [{ id: 'not-the-failing-eval', cause: 'x', closesWhen: 'y' }], true],
    ];
    for (const [name, reds, expectRefusal] of wiring) {
      led.reds = reds;
      writeFileSync(LED, JSON.stringify(led, null, 2) + '\n');
      const out = compareFailures(measuredPath);
      const refused = out.length > 0;
      const ok = refused === expectRefusal;
      console.log(`  ${ok ? '✔' : '✖'} ${name}`);
      if (!ok) { failures++; console.log(`      expected ${expectRefusal ? 'a refusal' : 'none'}; got: ${out.join(' | ') || '(none)'}`); }
    }
  } finally {
    writeFileSync(REC, recBak);
    writeFileSync(LED, ledBak);
  }
}

console.log(failures === 0 ? '\n✔ named-red ledger: 10 planted cases, all behave' : `\n✖ ${failures} planted case(s) did not behave`);
process.exit(failures === 0 ? 0 : 1);
