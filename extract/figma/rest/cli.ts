/**
 * CLI wrapper for the REST import path (fetch.ts owns the HTTP, map.ts the
 * REST→dump mapping; this file owns argv/env/fs — the only node-bound layer).
 *
 *   npm run extract:figma:rest -- <figma-url> [--token <token>] [--target Name] [--out path]
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

function main(): Promise<void> {
  const args = process.argv.slice(2);
  const readFlag = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const token = readFlag('--token') ?? process.env.FIGMA_TOKEN;
  const target = readFlag('--target');
  const outPath = readFlag('--out') ?? path.join('extract', 'out', 'figma', 'rest-dump.json');
  const url = args[0];
  if (!url || !token) {
    console.error(
      'Usage: npm run extract:figma:rest -- <figma-url> [--token <token>] [--target Name] [--out path]\n' +
        '  Token: --token or the FIGMA_TOKEN env var.',
    );
    process.exit(2);
  }

  let refusal: VariablesRefusal | undefined;
  return importFromUrl(url, token, {
    ...(target ? { target } : {}),
    onVariablesUnavailable: (info) => {
      refusal = info;
    },
  }).then(({ dump, report }) => {
    const resolved = path.resolve(process.cwd(), outPath);
    mkdirSync(path.dirname(resolved), { recursive: true });
    writeFileSync(resolved, JSON.stringify(dump, null, 2) + '\n');
    console.log(`✔ ${report.sets.length} set(s) [${report.sets.join(', ')}] → ${outPath}`);
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
