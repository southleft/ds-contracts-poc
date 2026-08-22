/**
 * JSON SCHEMA — FRESHNESS GATE. `npm run schema:fresh`
 *
 * The contract schema has ONE authority: the Zod document in
 * packages/schema/src/contract-schema.ts. Two JSON Schema projections of it
 * are committed — contracts/contract.schema.json (editor inline validation
 * via each contract's "$schema") and packages/schema/contract.schema.json
 * (shipped in @ds-contracts/schema) — and nothing compared either to a fresh
 * emission. On 2026-08-22 both were eleven days stale: the Zod document had
 * gained a literal-grammar superRefine (01aa5243) that JSON Schema cannot
 * express, so the committed JSON still carried the OLD regex (which false-reds
 * a legal box-shadow stack) while a fresh emission carries none. Editors and
 * non-TS tooling saw a schema that disagreed with the authority in both
 * directions, and the CI "build + git diff" freshness gate was excluded as
 * "byte-inert" — it was not.
 *
 * This emits in memory (no file is touched during a check) and refuses when
 * either committed copy differs from the projection. Regenerate with
 * `npm run schema && npm --prefix packages/schema run build`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as z from 'zod';
import { ContractSchema } from '../packages/schema/src/contract-schema.js';

const ROOT = process.cwd();
const fresh = JSON.stringify(z.toJSONSchema(ContractSchema, { target: 'draft-7', io: 'input' }), null, 2) + '\n';

const COPIES = ['contracts/contract.schema.json', 'packages/schema/contract.schema.json'];
const failures: string[] = [];
for (const rel of COPIES) {
  const file = path.join(ROOT, rel);
  let committed = '';
  try {
    committed = readFileSync(file, 'utf8');
  } catch {
    failures.push(`${rel}: missing`);
    continue;
  }
  if (committed === fresh) {
    console.log(`  ✔ ${rel} is byte-identical to a fresh emission (${fresh.length} bytes)`);
    continue;
  }
  const a = committed.split('\n');
  const b = fresh.split('\n');
  let first = 0;
  while (first < a.length && first < b.length && a[first] === b[first]) first++;
  failures.push(
    `${rel}: STALE vs the Zod authority — ${committed.length} committed bytes vs ${fresh.length} fresh; first differing line ${first + 1}: ` +
      `committed ${JSON.stringify(a[first] ?? '<eof>')} · fresh ${JSON.stringify(b[first] ?? '<eof>')}`,
  );
}

if (failures.length) {
  console.error(`✖ schema:fresh — ${failures.length} stale projection(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error('  Regenerate: npm run schema && npm --prefix packages/schema run build');
  process.exit(1);
}
console.log('✔ schema:fresh — both JSON Schema projections match the Zod document');
