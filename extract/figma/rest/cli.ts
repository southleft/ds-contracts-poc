/**
 * CLI wrapper for the REST import path (fetch.ts owns the HTTP, map.ts the
 * REST→dump mapping; this file owns argv/env/fs — the only node-bound layer).
 *
 *   npm run extract:figma:rest -- <figma-url> [--token <token>] [--target Name] [--out path]
 *
 * Token: --token flag, else FIGMA_TOKEN env. Output: dump v1 JSON (default
 * extract/out/figma/rest-dump.json) ready for `npm run extract:figma -- <dump>`.
 * The MapReport — every degradation, named — prints to stderr and rides the
 * dump's _provenance next to nothing: refusals are receipts, not silence.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { importFromUrl } from './fetch.js';

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

  return importFromUrl(url, token, target ? { target } : {}).then(({ dump, report }) => {
    const resolved = path.resolve(process.cwd(), outPath);
    mkdirSync(path.dirname(resolved), { recursive: true });
    writeFileSync(resolved, JSON.stringify(dump, null, 2) + '\n');
    console.log(`✔ ${report.sets.length} set(s) [${report.sets.join(', ')}] → ${outPath}`);
    for (const n of report.notes) console.error(`note: ${n}`);
    for (const d of report.degradations) console.error(`degraded [${d.code}] ${d.nodePath}${d.field ? ` ${d.field}` : ''}: ${d.message}`);
    if (report.sets.length === 0) process.exit(1);
  });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
