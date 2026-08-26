/**
 * THE NAMED-RED LEDGER — the rule, on its own, so it can be tested.
 *
 * A red eval suite is permitted ONLY when every failing eval is named, caused,
 * and carries a stated closing condition. This lives in its own module rather
 * than inside docs-numbers-check.mjs for a reason worth writing down: that file
 * runs its whole check on import and calls process.exit(1) at top level, so a
 * self-test that imported it would EXIT BEFORE RUNNING on exactly the branches
 * where the suite is red — reporting failure while having measured nothing.
 */
/** Returns [] when the suite is green, whatever the ledger says. */
export function evalRedFailures(results, ledger, ledgerPath) {
  const out = [];
  const add = (where, msg) => out.push({ where, msg });
  if (results.passed === results.total) return out;
  const failing = results.results.filter((r) => r.pass === false).map((r) => r.id);
  if (!ledger) {
    add('evals/results.json', `${results.passed}/${results.total} — the committed run is RED and ${ledgerPath} does not exist, so no red is named`);
    return out;
  }
  const rows = Array.isArray(ledger.reds) ? ledger.reds : [];
  const named = new Map(rows.map((r) => [r.id, r]));
  const unnamed = failing.filter((id) => !named.has(id));
  if (unnamed.length > 0) {
    add('evals/results.json', `${results.passed}/${results.total} — ${unnamed.length} red(s) NOT named in ${ledgerPath}: ${unnamed.join(', ')} — an unnamed red is a silent failure; add a row with its cause and what closes it`);
  }
  const stale = [...named.keys()].filter((id) => !failing.includes(id));
  if (stale.length > 0) {
    add(ledgerPath, `${stale.length} row(s) name an eval that now PASSES: ${stale.join(', ')} — delete them; a ledger nobody prunes stops being read`);
  }
  for (const r of rows) {
    if (!r.cause || !String(r.cause).trim()) add(ledgerPath, `${r.id}: no cause — "it fails" is not a cause`);
    if (!r.closesWhen || !String(r.closesWhen).trim()) add(ledgerPath, `${r.id}: no closesWhen — name the event that makes it pass, not "when fixed"`);
  }
  return out;
}
