/**
 * TWO BROWSERS IN ONE EVIDENCE FILE — `npm run mixed-browser:check`
 *
 * A `captured-truth.json` carries TWO browser facts, each stamped live by
 * `extract/computed/capture.ts`:
 *
 *   _provenance.browser            — the browser the component was captured on
 *   _provenance.uaBaselineBrowser  — the browser the UA CONTROL was measured on
 *
 * When they disagree, the file staples two browsers into one piece of evidence:
 * the styled-channel door (`fuse.control-element-delta`) subtracts a control
 * measured on browser B from a component captured on browser A, so any channel
 * whose computed value CHANGED between A and B is carried as if the library had
 * authored it. That is not hypothetical — it is what happened, and it is why the
 * pinned re-record on v1-integration-2 moved exactly 37 rows.
 *
 * WHY A GATE AND NOT ONLY A DOC ENTRY (docs/23 §D.36). The class is known,
 * counted, and deliberately NOT repaired yet: repairing it means re-running
 * `ua-baseline-backfill` under the pinned resolver AND re-recording the drift
 * baseline in the SAME round, because the two must move together. A doc entry
 * records the 37. Only a gate notices the 38th.
 *
 * THE ALLOWANCE IS A CEILING, NOT A TARGET. It fails when the class GROWS. It
 * does not fail when the class shrinks — it prints loudly instead, because the
 * honest end state is 0 and tightening the allowance is a reviewed act, not a
 * side effect of a passing run. Both branches print the per-library breakdown
 * every run, so the number is never invisible.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(REPO, 'extract/computed/out');

/**
 * KNOWN, NAMED, AND WAITING FOR ITS REPAIR ROUND (docs/23 §D.36).
 * 37 = altitude 8 + carbon 10 + mui 14 + tailwind 5, arriving on
 * v1-integration-2 via #45's UA-baseline backfill. `main` carries 0 today.
 * Drop this to the new count — and say what closed it — in the round that
 * re-runs the backfill under the pinned resolver.
 */
const ALLOWANCE = 37;

const bare = (v: string | undefined): string | null => (v ? (/(\d+(?:\.\d+)+)/.exec(v)?.[1] ?? null) : null);

const mixed: Array<{ rel: string; captured: string; uaControl: string }> = [];
let scanned = 0;

function walk(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name === 'captured-truth.json') {
      scanned++;
      let prov: { browser?: string; uaBaselineBrowser?: string };
      try {
        prov = (JSON.parse(readFileSync(p, 'utf8')) as { _provenance?: typeof prov })._provenance ?? {};
      } catch {
        continue;
      }
      const captured = bare(prov.browser);
      const uaControl = bare(prov.uaBaselineBrowser);
      // No UA control recorded at all is a DIFFERENT state (the capture predates
      // the backfill) and is not this defect — do not conflate the two.
      if (captured === null || uaControl === null) continue;
      if (captured !== uaControl) mixed.push({ rel: path.relative(REPO, p), captured, uaControl });
    }
  }
}

walk(OUT);

const byLibrary = new Map<string, number>();
for (const m of mixed) {
  const parts = m.rel.split(path.sep);
  const i = parts.indexOf('out');
  const lib = parts.length - i > 3 ? parts[i + 1] : '(un-namespaced root)';
  byLibrary.set(lib, (byLibrary.get(lib) ?? 0) + 1);
}

console.log(`TWO BROWSERS IN ONE EVIDENCE FILE — ${scanned} captured-truth.json scanned\n`);
console.log(`  mixed-browser captures: ${mixed.length}  (allowance ${ALLOWANCE})`);
for (const [lib, n] of [...byLibrary].sort()) console.log(`      ${lib.padEnd(22)} ${n}`);
if (mixed.length > 0) {
  const shown = mixed.slice(0, 6);
  for (const m of shown) console.log(`      · ${m.rel} — captured on ${m.captured}, UA control on ${m.uaControl}`);
  if (mixed.length > shown.length) console.log(`      · … and ${mixed.length - shown.length} more`);
}
console.log('');

if (mixed.length > ALLOWANCE) {
  console.error(
    `✖ mixed-browser captures GREW ${ALLOWANCE} -> ${mixed.length}. A capture whose UA control was measured on a ` +
      'different browser than its base subtracts a control the component never saw, so channels that merely CHANGED ' +
      'between the two browsers are carried as if the library authored them.\n' +
      '  Re-run extract/computed/ua-baseline-backfill.ts under the pinned resolver (it now resolves the revision ' +
      'playwright-core pins), and re-record the drift baseline in the SAME round — the two must move together.\n' +
      '  Raising the allowance is NOT the fix and must never be the whole change.',
  );
  process.exit(1);
}
if (mixed.length < ALLOWANCE) {
  console.log(
    `  ⚠ the class SHRANK ${ALLOWANCE} -> ${mixed.length}. That is the direction we want, and the allowance is now ` +
      'stale: tighten ALLOWANCE in this file to the new count and say what closed it, in the same change that closed ' +
      'it. An unrecorded win drifts exactly like a loss.',
  );
}
console.log(
  `✔ mixed-browser captures: ${mixed.length} of an allowed ${ALLOWANCE}, each one named — the class cannot grow silently.`,
);
