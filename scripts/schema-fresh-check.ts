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
import { readFileSync } from "node:fs";
import path from "node:path";
import * as z from "zod";
import { ContractSchema } from "../packages/schema/src/contract-schema.js";
import { checkCoverage } from "../site/src/coverage.js";

const ROOT = process.cwd();
const fresh =
  JSON.stringify(
    z.toJSONSchema(ContractSchema, { target: "draft-7", io: "input" }),
    null,
    2,
  ) + "\n";

const COPIES = [
  "contracts/contract.schema.json",
  "packages/schema/contract.schema.json",
];
const failures: string[] = [];
for (const rel of COPIES) {
  const file = path.join(ROOT, rel);
  let committed = "";
  try {
    committed = readFileSync(file, "utf8");
  } catch {
    failures.push(`${rel}: missing`);
    continue;
  }
  if (committed === fresh) {
    console.log(
      `  ✔ ${rel} is byte-identical to a fresh emission (${fresh.length} bytes)`,
    );
    continue;
  }
  const a = committed.split("\n");
  const b = fresh.split("\n");
  let first = 0;
  while (first < a.length && first < b.length && a[first] === b[first]) first++;
  failures.push(
    `${rel}: STALE vs the Zod authority — ${committed.length} committed bytes vs ${fresh.length} fresh; first differing line ${first + 1}: ` +
      `committed ${JSON.stringify(a[first] ?? "<eof>")} · fresh ${JSON.stringify(b[first] ?? "<eof>")}`,
  );
}

// ---------------------------------------------------------------------------
// THE THIRD PROJECTION: the reference site.
//
// A schema branch is not shipped until a human can read what it MEANS, and the
// site's coverage registry is what pairs each branch with the page that says
// so. That guard already existed — but it only ran inside `site:build`, which
// lives in the RC job, so an undocumented branch stayed invisible through the
// entire fast lane and surfaced late, on a job most contributors never watch.
// It has now happened TWICE in one round: `part.codeOnly` / `part.codeOnly.*`,
// and then v19's `contract.archetype` (#44), which went red on `full gate
// sweep` AND both `build RC` jobs for this one cause.
//
// The remedy is not to loosen the guard — the discipline is working, it was
// simply reporting too late. So the same `checkCoverage()` the site refuses on
// is called HERE, in a gate that costs seconds and runs in the fast lane, and
// it fails closed at the moment the schema changes rather than at packaging
// time. One registry, one rule, named at the first place it can be known.
{
  const receipt = checkCoverage();
  for (const branch of receipt.missing) {
    failures.push(
      `${branch}: the Zod document has this branch and NO reference page documents it — ` +
        `map it in site/src/coverage.ts and write it up on that page (this is the guard site:build refuses on, ` +
        `run here so it fails in the fast lane instead of in the RC job)`,
    );
  }
  for (const branch of receipt.stale) {
    failures.push(
      `${branch}: site/src/coverage.ts documents this branch and the Zod document NO LONGER HAS IT — ` +
        `a page describing a field nobody can write is as wrong as an undocumented one; remove the registry row`,
    );
  }
  if (receipt.missing.length === 0 && receipt.stale.length === 0) {
    console.log(
      `  ✔ all ${receipt.schemaBranches} schema branches are documented on a reference page (0 missing, 0 stale)`,
    );
  }
}

if (failures.length) {
  console.error(`✖ schema:fresh — ${failures.length} failure(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "  Regenerate the projections: npm run schema && npm --prefix packages/schema run build",
  );
  console.error(
    "  Undocumented/stale branch: map it in site/src/coverage.ts and document it on that page.",
  );
  process.exit(1);
}
console.log(
  "✔ schema:fresh — both JSON Schema projections match the Zod document, and every branch is documented",
);
