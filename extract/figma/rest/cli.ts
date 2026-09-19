/**
 * CLI wrapper for the REST import path (fetch.ts owns the HTTP, map.ts the
 * REST→dump mapping; this file owns argv/env/fs — the only node-bound layer).
 *
 *   npm run extract:figma:rest -- <figma-url> [--token <token>] [--target Name] [--out path] [--no-closure]
 *
 * DEPENDENCY CLOSURE (default ON, docs/23 §D.43): every same-file component
 * set an INSTANCE in the imported set references is fetched too —
 * transitively, capped at CLOSURE_SET_CAP pulled sets — and mapped into the
 * same dump, so its instances propose as REAL child contracts instead of
 * geometry-only stubs. A remote (library) component, a missing one, one past
 * the cap, … stays a stub and is named per reference (`_provenance.closure`,
 * `instance-closure-unresolved` rows). `--no-closure` maps the requested set
 * alone, byte-identical to the import before the closure existed.
 *
 * Token: --token flag, else FIGMA_TOKEN env. Output: dump v1 JSON (default
 * extract/out/figma/rest-dump.json) ready for `npm run extract:figma -- <dump>`.
 * The MapReport — every degradation, named — prints to stderr AND rides the
 * dump as `_degradations` (Phase 2 exam, 2026-08-22: before that the 1,748
 * receipts lived only on a terminal). A refused variables endpoint is named
 * BY CAUSE — scope missing (user-fixable, the fix printed), plan-or-unknown,
 * or network — on stderr, in the dump and in the proposal report; never
 * "Enterprise" by assumption.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { importFromUrl, type VariablesRefusal } from './fetch.js';
import { CLOSURE_SET_CAP } from './closure.js';

function main(): Promise<void> {
  const args = process.argv.slice(2);
  const readFlag = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const token = readFlag('--token') ?? process.env.FIGMA_TOKEN;
  const target = readFlag('--target');
  const outPath = readFlag('--out') ?? path.join('extract', 'out', 'figma', 'rest-dump.json');
  const noClosureAt = args.indexOf('--no-closure');
  const closure = noClosureAt < 0;
  if (noClosureAt >= 0) args.splice(noClosureAt, 1);
  const url = args[0];
  if (!url || !token) {
    console.error(
      'Usage: npm run extract:figma:rest -- <figma-url> [--token <token>] [--target Name] [--out path] [--no-closure]\n' +
        '  Token: --token or the FIGMA_TOKEN env var.\n' +
        `  Closure (default): same-file sets the imported set's instances reference are imported too (at most ${CLOSURE_SET_CAP}),\n` +
        '  so they become real child contracts; --no-closure imports the requested set alone.',
    );
    process.exit(2);
  }

  let refusal: VariablesRefusal | undefined;
  return importFromUrl(url, token, {
    ...(target ? { target } : {}),
    ...(closure ? { closure: true } : {}),
    onVariablesUnavailable: (info) => {
      refusal = info;
    },
  }).then(({ dump, report }) => {
    const resolved = path.resolve(process.cwd(), outPath);
    mkdirSync(path.dirname(resolved), { recursive: true });
    writeFileSync(resolved, JSON.stringify(dump, null, 2) + '\n');
    console.log(`✔ ${report.sets.length} set(s) [${report.sets.join(', ')}] → ${outPath}`);
    const c = dump._provenance?.closure;
    if (c) {
      console.log(
        `✔ closure: requested [${c.requested.map((r) => r.name).join(', ')}]; followed ${c.pulled.length} same-file set(s)${c.pulled.length ? ` [${c.pulled.map((p) => p.name).join(', ')}]` : ''}; ${c.unresolved.length} reference target(s) not followed (stubs, named below)`,
      );
      for (const u of c.unresolved) {
        console.error(`closure: not followed [${u.reason}] ${u.name ?? u.targetId} (${u.targetId}) ← ${u.referencedFrom.length} instance(s): ${u.detail}`);
      }
      for (const [from, to] of c.cycles) console.error(`closure: cycle cut at ${from} → ${to} — ${from} is proposed first, so its reference to ${to} is an auto-proposed stub; the propose CLI skips that stub file when ${to}'s real contract claims the same id`);
    } else if (!closure) {
      console.log('- closure: off (--no-closure) — instances of other sets stay auto-proposed stubs');
    }
    if (refusal) {
      // The cause, by name, before the 1,595 consequences scroll past.
      console.error(`✖ variables: ${refusal.kind === 'scope' ? 'TOKEN SCOPE MISSING' : refusal.kind === 'network' ? 'NETWORK' : `REFUSED (HTTP ${refusal.status}, cause unknown)`} — ${refusal.message}`);
      if (refusal.fix) console.error(`  fix: ${refusal.fix}`);
    } else if (dump._variables) {
      console.log(`✔ variables: ${Object.keys(dump._variables).length} bound variable(s) captured with values (\`_variables\`) — propose writes captured.dtcg.json`);
    }
    for (const n of report.notes) console.error(`note: ${n}`);
    const byCode = new Map<string, number>();
    for (const d of report.degradations) byCode.set(d.code, (byCode.get(d.code) ?? 0) + 1);
    if (report.degradations.length > 0) {
      console.error(
        `${report.degradations.length} receipt(s) carried in the dump as _degradations: ${[...byCode].map(([c, n]) => `${n} ${c}`).join(' · ')}`,
      );
    }
    for (const d of report.degradations) console.error(`degraded [${d.code}] ${d.nodePath}${d.field ? ` ${d.field}` : ''}: ${d.message}`);
    if (report.sets.length === 0) process.exit(1);
  });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
