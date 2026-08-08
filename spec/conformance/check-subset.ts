/**
 * Wave 11-A/B — prove the frozen conformance subset still matches
 * conformance/MANIFEST.json (no silent widen/shrink of expected dispositions).
 *
 *   npx tsx spec/conformance/check-subset.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const subset = JSON.parse(
  readFileSync(path.join(ROOT, 'spec/conformance/subset-v0.1.json'), 'utf8'),
) as {
  id: string;
  normativeRules: Array<{ id: string }>;
  fixtures: { cases: Array<{ id: string; expect: string }> };
};
const fixtureIndex = JSON.parse(
  readFileSync(path.join(ROOT, 'spec/conformance/fixture-index-v0.1.json'), 'utf8'),
) as {
  subsetId: string;
  cases: Array<{ id: string; expect: string; case: string; seed: string }>;
};
const manifest = JSON.parse(
  readFileSync(path.join(ROOT, 'conformance/MANIFEST.json'), 'utf8'),
) as { cases: Array<{ id: string; expect: string }> };

const byId = new Map(manifest.cases.map((c) => [c.id, c]));
const errors: string[] = [];

if (fixtureIndex.subsetId !== subset.id) {
  errors.push(
    `fixture-index subsetId ${fixtureIndex.subsetId} !== subset id ${subset.id}`,
  );
}

const ruleIds = new Set(subset.normativeRules.map((r) => r.id));
if (ruleIds.size !== subset.normativeRules.length) {
  errors.push('duplicate normative rule ids in subset-v0.1.json');
}

const indexById = new Map(fixtureIndex.cases.map((c) => [c.id, c]));
const seen = new Set<string>();
for (const fx of subset.fixtures.cases) {
  if (seen.has(fx.id)) errors.push(`duplicate fixture id: ${fx.id}`);
  seen.add(fx.id);
  const m = byId.get(fx.id);
  if (!m) {
    errors.push(`fixture ${fx.id}: absent from conformance/MANIFEST.json`);
    continue;
  }
  if (m.expect !== fx.expect) {
    errors.push(
      `fixture ${fx.id}: subset expects ${fx.expect} but MANIFEST has ${m.expect}`,
    );
  }
  const casePath = path.join(ROOT, 'conformance/cases', fx.id, 'case.json');
  try {
    const local = JSON.parse(readFileSync(casePath, 'utf8')) as { expect: string };
    if (local.expect !== fx.expect) {
      errors.push(
        `fixture ${fx.id}: case.json expects ${local.expect} but subset has ${fx.expect}`,
      );
    }
  } catch {
    errors.push(`fixture ${fx.id}: missing conformance/cases/${fx.id}/case.json`);
  }
  const indexed = indexById.get(fx.id);
  if (!indexed) {
    errors.push(`fixture ${fx.id}: missing from fixture-index-v0.1.json`);
  } else {
    if (indexed.expect !== fx.expect) {
      errors.push(
        `fixture ${fx.id}: index expects ${indexed.expect} but subset has ${fx.expect}`,
      );
    }
    for (const rel of [indexed.case, indexed.seed]) {
      if (!existsSync(path.join(ROOT, rel))) {
        errors.push(`fixture ${fx.id}: indexed path missing: ${rel}`);
      }
    }
  }
}

for (const id of indexById.keys()) {
  if (!seen.has(id)) errors.push(`fixture-index has extra case not in subset: ${id}`);
}

const dispositions = new Set(subset.fixtures.cases.map((c) => c.expect));
for (const need of ['CARRIED', 'LOWERED', 'REFUSED', 'UNSUPPORTED'] as const) {
  if (!dispositions.has(need)) {
    errors.push(`subset missing any ${need} fixture — N-DISP-01 cannot be demonstrated`);
  }
}

if (errors.length) {
  console.error(`✖ spec/conformance/check-subset.ts (${subset.id}):`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}

console.log(
  `✔ spec/conformance/check-subset.ts: ${subset.normativeRules.length} rules + ${subset.fixtures.cases.length} fixtures agree with MANIFEST (${[...dispositions].sort().join(', ')})`,
);
