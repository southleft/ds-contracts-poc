/**
 * Verifies the sharded catalog is a faithful decomposition of the monolith:
 *   - catalog/index.json, catalog/tokens.json, and one shard per component exist
 *   - every component entry in catalog.json deep-equals its shard
 *   - index propNames match the shard's props exactly (order included)
 *   - index summaries are non-empty; token groups present; protocol documented
 * Prints byte / estimated-LLM-token (bytes/4) sizes of index.json vs catalog.json.
 *
 * Usage: node scripts/verify-catalog-shards.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { deepStrictEqual } from 'node:assert';

const ROOT = process.cwd();
const p = (...parts) => path.join(ROOT, 'catalog', ...parts);
const read = (...parts) => JSON.parse(readFileSync(p(...parts), 'utf8'));

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`  ✘ ${msg}`);
};

const shardName = (id) => id.replace(/^[^.]+\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

// --- files exist -------------------------------------------------------------
const catalog = read('catalog.json');
const index = read('index.json');
const tokens = read('tokens.json');

console.log('Checking sharded catalog against catalog/catalog.json …');

// --- protocol is self-describing ---------------------------------------------
if (typeof index._protocol !== 'string' || !index._protocol.includes('index.json')) {
  fail('index.json is missing a _protocol field describing the retrieval protocol');
}

// --- tokens.json is exactly the token section --------------------------------
try {
  deepStrictEqual(tokens, catalog.tokens);
} catch {
  fail('tokens.json does not deep-equal catalog.json .tokens');
}
if (!Array.isArray(index.tokenGroups) || index.tokenGroups.length === 0) {
  fail('index.json has no tokenGroups');
}

// --- system meta + rules carried into the index -------------------------------
try {
  deepStrictEqual(index.system, catalog.system);
  deepStrictEqual(index.rules, catalog.rules);
} catch {
  fail('index.json system/rules do not match catalog.json');
}

// --- every component: shard exists, deep-equal, index row consistent ----------
const indexById = new Map(index.components.map((c) => [c.id, c]));
if (index.components.length !== catalog.components.length) {
  fail(
    `index has ${index.components.length} components, catalog has ${catalog.components.length}`,
  );
}

for (const comp of catalog.components) {
  const file = `${shardName(comp.id)}.json`;
  let shard;
  try {
    shard = read('components', file);
  } catch {
    fail(`missing shard catalog/components/${file} for ${comp.id}`);
    continue;
  }
  try {
    deepStrictEqual(shard, comp);
  } catch {
    fail(`shard ${file} is not identical to the catalog.json entry for ${comp.id}`);
  }

  const row = indexById.get(comp.id);
  if (!row) {
    fail(`index.json has no row for ${comp.id}`);
    continue;
  }
  try {
    deepStrictEqual(row.propNames, comp.props.map((pr) => pr.name));
  } catch {
    fail(`index propNames for ${comp.id} do not match the component's props`);
  }
  if (row.name !== comp.name || row.version !== comp.version || row.status !== comp.status) {
    fail(`index row for ${comp.id} disagrees with the shard on name/version/status`);
  }
  if (typeof row.summary !== 'string' || row.summary.length === 0) {
    fail(`index row for ${comp.id} has an empty summary`);
  }
}

// --- no orphan shards ----------------------------------------------------------
const expected = new Set(catalog.components.map((c) => `${shardName(c.id)}.json`));
for (const f of readdirSync(p('components'))) {
  if (!expected.has(f)) fail(`orphan shard catalog/components/${f} has no catalog entry`);
}

// --- size report -----------------------------------------------------------------
const size = (...parts) => statSync(p(...parts)).size;
const fmt = (bytes) =>
  `${bytes.toLocaleString('en-US')} bytes ≈ ${Math.round(bytes / 4).toLocaleString('en-US')} LLM tokens`;
const shardBytes = readdirSync(p('components')).reduce((sum, f) => sum + size('components', f), 0);

console.log('');
console.log(`  catalog.json  ${fmt(size('catalog.json'))}`);
console.log(`  index.json    ${fmt(size('index.json'))}`);
console.log(`  tokens.json   ${fmt(size('tokens.json'))}`);
console.log(
  `  components/   ${catalog.components.length} shards, ${fmt(shardBytes)} total (fetched per-use)`,
);
console.log(
  `  always-loaded surface: index.json is ${(
    (size('index.json') / size('catalog.json')) * 100
  ).toFixed(1)}% of catalog.json`,
);
console.log('');

if (failures > 0) {
  console.error(`✘ ${failures} check(s) failed`);
  process.exit(1);
}
console.log(`✔ Sharded catalog verified: ${catalog.components.length} shards identical to catalog.json, index consistent`);
