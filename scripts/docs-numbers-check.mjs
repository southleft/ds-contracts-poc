#!/usr/bin/env node
/**
 * DOCS NUMBERS CHECK — `npm run docs:check`
 *
 * The day's recurring lesson in this repo is that UNGATED SURFACES ROT. Docs
 * are a surface. This is that lesson applied to them.
 *
 * Every number a doc quotes about this repo is derived from a file in this
 * repo. This script re-derives each one and fails, by name, when a doc
 * disagrees — the same refusal discipline the engine applies to contracts,
 * pointed at prose. It is deliberately cheap: no browser, no eval run, no
 * build. It READS `evals/results.json`; it never runs `npm run eval`.
 *
 * Invariants:
 *   1. eval count   — evals/results.json `total` (and `passed === total`)
 *   2. contract count — contracts/*.contract.json
 *   3. token count  — distinct DTCG leaf names under tokens/
 *   4. links        — every relative markdown link target exists on disk
 *
 * Escape hatch: a line containing `<!-- docs-check:ignore -->` is skipped.
 * Use it ONLY for a number that is deliberately historical ("Round 5 shipped
 * with 24/24 evals"), never to silence a stale current claim.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IGNORE = '<!-- docs-check:ignore -->';

const rel = (p) => path.relative(ROOT, p) || '.';
const failures = [];
const fail = (where, msg) => failures.push(`${where}: ${msg}`);

// ---------------------------------------------------------------------------
// Sources of truth — derived, never typed twice
// ---------------------------------------------------------------------------
const results = JSON.parse(readFileSync(path.join(ROOT, 'evals/results.json'), 'utf8'));
const EVALS = results.total;
if (results.passed !== results.total) {
  fail('evals/results.json', `${results.passed}/${results.total} — the committed run is RED; docs quoting "N/N pass" would be a false claim`);
}
if (results.results.length !== results.total) {
  fail('evals/results.json', `total=${results.total} but ${results.results.length} result rows`);
}

const CONTRACTS = readdirSync(path.join(ROOT, 'contracts')).filter((f) => f.endsWith('.contract.json')).length;

const CAPTURE_CONFIGS = readdirSync(path.join(ROOT, 'extract/computed/configs')).filter((f) => f.endsWith('.json')).length;

const TOKENS = (() => {
  const names = new Set();
  const walk = (node, prefix) => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$')) continue;
      if (!v || typeof v !== 'object') continue;
      const p = prefix ? `${prefix}.${k}` : k;
      if ('$value' in v) names.add(p);
      else walk(v, p);
    }
  };
  const files = [];
  const collect = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) collect(p);
      else if (e.name.endsWith('.json')) files.push(p);
    }
  };
  collect(path.join(ROOT, 'tokens'));
  for (const f of files) walk(JSON.parse(readFileSync(f, 'utf8')), '');
  return names.size;
})();

// ---------------------------------------------------------------------------
// The documents under gate (working notes and dated logs are NOT gated —
// MILESTONES.md and CHANGELOG.md are history and must keep their old numbers)
// ---------------------------------------------------------------------------
const DOCS = [
  'README.md',
  'CONTRIBUTING.md',
  'ROADMAP.md',
  ...readdirSync(path.join(ROOT, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join('docs', f)),
];

// ---------------------------------------------------------------------------
// Number claims: [label, regex with one-or-two numeric groups, expected]
// Regexes are deliberately TIGHT — they match the phrasings the docs actually
// use, so a prose number about something else can never be caught by accident.
// ---------------------------------------------------------------------------
const CLAIMS = [
  ['eval count', /(\d+)\s*\/\s*(\d+)\s+(?:deterministic\s+|machinery\s+)*evals?\b/gi, () => EVALS],
  ['eval count', /\b(\d+)\s+executable checks\b/gi, () => EVALS],
  ['eval count', /\b(\d+)\s+deterministic (?:checks|evals)\b/gi, () => EVALS],
  ['eval count', /\bthe\s+(\d+)\s+evals\b/gi, () => EVALS],
  ['eval count', /`npm run eval`[^\n]*?\b(\d+)\s+(?:cases|checks|evals)\b/gi, () => EVALS],
  ['eval count', /\b(\d+)\s+(?:cases|checks|evals)\b[^\n]*?`npm run eval`/gi, () => EVALS],
  ['eval count', /npm run eval[^\n]*?#[^\n]*?\b(\d+)\s+(?:cases|checks|evals)\b/gi, () => EVALS],
  // Contract-count patterns are anchored to phrasings that can only mean THIS
  // repo's library — a bare "44 contracts" is usually about an example library
  // or an eval fixture, and gating it would produce noise instead of signal.
  ['contract count', /\b(\d+)\s+component contracts\b/gi, () => CONTRACTS],
  ['contract count', /\ball\s+(\d+)\s+contracts\b/gi, () => CONTRACTS],
  ['contract count', /\bthis repo(?:'|’)?s?\s+(\d+)\s+contracts\b/gi, () => CONTRACTS],
  ['token count', /\b(\d+)\s+DTCG(?:\s+design)?\s+tokens\b/gi, () => TOKENS],
  ['capture-config count', /\b(\d+)\s+committed capture configs\b/gi, () => CAPTURE_CONFIGS],
];

for (const doc of DOCS) {
  const abs = path.join(ROOT, doc);
  if (!existsSync(abs)) continue;
  const lines = readFileSync(abs, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes(IGNORE)) return;
    for (const [label, re, expected] of CLAIMS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        const want = expected();
        const got = m.slice(1).filter((g) => g !== undefined).map(Number);
        if (got.some((n) => n !== want)) {
          fail(`${doc}:${i + 1}`, `${label} — doc says ${got.join('/')}, derived value is ${want}  ("${m[0].trim()}")`);
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Link rot: every relative markdown link target must exist
// ---------------------------------------------------------------------------
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
for (const doc of DOCS) {
  const abs = path.join(ROOT, doc);
  if (!existsSync(abs)) continue;
  const lines = readFileSync(abs, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes(IGNORE)) return;
    LINK.lastIndex = 0;
    let m;
    while ((m = LINK.exec(line)) !== null) {
      const raw = m[1];
      if (/^(https?:|mailto:|#|data:)/.test(raw)) continue;
      const target = raw.split('#')[0];
      if (!target) continue;
      if (/[<>*{}]/.test(target)) continue; // placeholder path in a template
      const resolved = path.resolve(path.dirname(abs), target);
      if (!existsSync(resolved)) fail(`${doc}:${i + 1}`, `dead link → ${raw}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const derived = [
  `evals            ${EVALS} (evals/results.json)`,
  `contracts        ${CONTRACTS} (contracts/*.contract.json)`,
  `DTCG tokens      ${TOKENS} (tokens/**)`,
  `capture configs  ${CAPTURE_CONFIGS} (extract/computed/configs/*.json)`,
];
console.log(`docs:check — derived values\n  ${derived.join('\n  ')}\n  documents gated  ${DOCS.length}`);

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} stale doc claim(s):\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(
    `\nFix the docs, or — if a number is deliberately historical — put ${IGNORE} on that line.\n` +
      `If the eval suite legitimately changed size, re-run \`npm run eval\` first: this script reads\n` +
      `evals/results.json and never runs the suite itself.`,
  );
  process.exit(1);
}
console.log('\n✔ every gated doc number and link agrees with the repo');
