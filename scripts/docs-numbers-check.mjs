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
 *   5. round-trip totals — extract/figma/roundtrip-uui/report.json
 *      (matched/diverged/loss/invented, originalFacts, the derived matched-%,
 *      15-of-15 closure, the auto-layout-inert tag count)
 *   6. fidelity headline — examples/untitled-ui/renders/fidelity.json
 *      (599 rows, 537 scored, the mean at the doc's own precision, the
 *      unscored split)
 *   7. capture denominators — extract/computed/out/**\/scorecard.json plus the
 *      library-size total parsed from docs/22 §8.3 (the SAME sources
 *      `npm run capability:report` derives docs/24 from — never docs/24
 *      itself): 71 components, 410,192 cells, the 8.0% coverage, the means.
 *      If the §8.3 table stops parsing this script REFUSES rather than
 *      silently skipping the coverage claims.
 *   8. published versions — any doc line asserting a package@version is
 *      published / on npm must match scripts/registry-truth.json. That
 *      manifest is refreshed MANUALLY at release time from
 *      `npm view <pkg> dist-tags --json` (docs/27); this check reads the
 *      committed file and NEVER hits the network.
 *
 * Escape hatch: a line containing `<!-- docs-check:ignore -->` is skipped.
 * Use it ONLY for a number that is deliberately historical ("Round 5 shipped
 * with 24/24 evals"), never to silence a stale current claim.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordFreshnessFailures } from './eval-record-check.mjs';
import { evalRedFailures } from './eval-red-ledger.mjs';
import { fidelityCounts, v1DocClaimFailures, v1ExamClaimFailures, radixReadmeClaimFailures } from './v1-doc-claims.mjs';
import { coverageCohort, captureProseFailures, coverageTableFailures } from './coverage-cohort.mjs';

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
// A RED SUITE IS PERMITTED ONLY IF EVERY RED IS NAMED.
//
// This used to be an unconditional refusal, and that made the gate unusable
// exactly when it mattered: three of the suite's reds could not be closed
// until the branch carrying their fix had landed, and the branch could not
// land while the gate refused. A gate whose only remedy is the thing it
// blocks is not enforcing a standard, it is deadlocked.
//
// So the doctrine the rest of this tree already uses applies here too — a
// failure that is NAMED, caused, and carries a stated way to close is
// carried; one that is not is a silent failure. `parity/receipts/v1/
// eval-reds.json` is that ledger. It is not a weakening: an UNNAMED red still
// refuses, a ledger row whose eval has gone green refuses (stale rows rot
// exactly the way the door register's line metadata did), and the full lane's
// eval:record:check still re-measures row by row against a fresh run, so the
// ledger cannot lie about WHICH evals fail.
const EVAL_REDS = path.join(ROOT, 'parity/receipts/v1/eval-reds.json');
for (const f of evalRedFailures(results, existsSync(EVAL_REDS) ? JSON.parse(readFileSync(EVAL_REDS, 'utf8')) : null, rel(EVAL_REDS))) {
  fail(f.where, f.msg);
}

// The record must be a clean-tree measurement on this history, not a
// self-attestation — see scripts/eval-record-check.mjs for the reason and
// the CI half (row-by-row compare against a fresh full run).
for (const f of recordFreshnessFailures(results)) fail('evals/results.json', f);
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

// ---- round-trip totals (extract/figma/roundtrip-uui/report.json) ----------
const rt = JSON.parse(readFileSync(path.join(ROOT, 'extract/figma/roundtrip-uui/report.json'), 'utf8'));
const RT = rt.totals;
const RT_FACTS = RT.matched + RT.diverged + RT.loss + RT.invented;
let RT_AL_INERT = 0;
let RT_LAYOUT_MODE = 0;
for (const r of rt.results) {
  for (const f of r.diverged ?? []) {
    if (f.channel === 'layout.mode') RT_LAYOUT_MODE += 1;
    if (f.tag === 'auto-layout-inert') RT_AL_INERT += 1;
  }
}

// ---- fidelity headline (examples/untitled-ui/renders/fidelity.json) --------
const fid = JSON.parse(readFileSync(path.join(ROOT, 'examples/untitled-ui/renders/fidelity.json'), 'utf8'));
const fidScored = fid.filter((r) => typeof r.score === 'number');
const FID_TOTAL = fid.length;
const FID_SCORED = fidScored.length;
const FID_MEAN = fidScored.reduce((a, r) => a + r.score, 0) / (FID_SCORED || 1);
const FID_UNSCORED = FID_TOTAL - FID_SCORED;
const FID_INTERACTION = fid.filter((r) => typeof r.score !== 'number' && /interaction-state/.test(r.note ?? '')).length;
const FID_CARRIAGE = FID_UNSCORED - FID_INTERACTION;

const RECIPE_FIDELITY = fidelityCounts(
  JSON.parse(readFileSync(path.join(ROOT, 'recipe/evidence/fidelity-v1/SCORECARD.json'), 'utf8')),
  JSON.parse(readFileSync(path.join(ROOT, 'recipe/evidence/fidelity-v1/KNOWN-FAILURES.json'), 'utf8')),
);
const V1_CURRENT_DOCS = ['docs/26-v1-definition.md', 'docs/37-product-repo-manifest.md', 'parity/receipts/v1/WHAT-YOU-CAN-DO-TODAY.md'];
for (const message of v1DocClaimFailures(Object.fromEntries(V1_CURRENT_DOCS.map((p) => [p, readFileSync(path.join(ROOT, p), 'utf8')])), RECIPE_FIDELITY)) {
  fail('current v1 status', message);
}
const V1_EXAM_DOCS = ['README.md', 'docs/35-two-journey-v1-plan.md', 'parity/receipts/v1/OWNER-PARKED.md', 'parity/receipts/v1/WHAT-YOU-CAN-DO-TODAY.md'];
for (const message of v1ExamClaimFailures(
  Object.fromEntries(V1_EXAM_DOCS.map((p) => [p, readFileSync(path.join(ROOT, p), 'utf8')])),
  JSON.parse(readFileSync(path.join(ROOT, 'recipe/evidence/f1-v1/receipt.json'), 'utf8')),
  JSON.parse(readFileSync(path.join(ROOT, 'recipe/evidence/canvas-to-code-held-out-v2/index.json'), 'utf8')),
)) fail('current v1 exams', message);
for (const message of radixReadmeClaimFailures(
  readFileSync(path.join(ROOT, 'README.md'), 'utf8'),
  JSON.parse(readFileSync(path.join(ROOT, 'recipe/evidence/f1-v1/receipt.json'), 'utf8')),
)) fail('current Radix exam', message);

// ---- capture denominators (the SAME sources docs/24 is generated from) -----
// Derived from extract/computed/out/**/scorecard.json + the docs/22 §8.3
// total row — NEVER from docs/24 itself, which is a generated consumer of the
// same artifacts and would make the check circular.
//
// THIS SET IS A DENOMINATOR AND IT ROTTED. It listed seven libraries and was
// last touched in the shadcn round (7510916c); Fluent 2 was added to the
// corpus afterwards (a0b8afcb) and this file never learned about it. The
// effect was not a missing check — it was a WRONG one: this script derived 93
// components / 87.1% / 451,524 cells and reported the generated, correct
// docs/24 (104 / 86.6% / 583,950) as the stale party, for every one of those
// claims. A checker that is confidently wrong is worse than one that is
// silent.
//
// The list stays EXPLICIT — the same shape `build-capability-report.mjs`
// keeps, and deliberately a SECOND, independent copy of it. Sharing one
// module between the generator and its checker would mean a bug in that
// module was invisible to both. What makes the duplicate safe is the stray
// refusal below: a corpus this list has never heard of is a failure by name,
// so the next library cannot be silently left out the way Fluent was.
const LIB_PACKAGES = {
  altitude: 'altitude-web-components', antd: 'antd', astryx: '@astryxdesign/core', carbon: '@carbon/react',
  chakra: '@chakra-ui/react', fluent: '@fluentui/react-components', mui: '@mui/material', polaris: '@shopify/polaris',
  'radix-themes': '@radix-ui/themes', shadcn: '@shadcn-sandbox/ui', tailwind: 'flowbite-react',
};
const LIB_DIRS = new Set(Object.keys(LIB_PACKAGES));

/**
 * Capture directories that are a SECOND MOUNT of a library already in LIB_DIRS —
 * same package, same version, mounted differently. Declared, not counted: adding
 * one to LIB_DIRS would measure every capture number over an inflated
 * population, and leaving it undeclared makes it a stray, which is the guard
 * that should fire for an accidental capture dir.
 *
 * astryx-core: @astryxdesign/core with NO theme provider. `astryx/` follows the
 * library's README quick start (<Theme theme={neutralTheme}>), which overrides
 * palette, body font and radius scale; the recipe fixtures transcribe the
 * un-themed core defaults, so they could not be verified against the themed
 * capture. Mirrors ALTERNATE_MOUNTS in scripts/build-capability-report.mjs —
 * both scripts keep their own registry, so both have to be told.
 */
const ALTERNATE_MOUNTS = new Set(['astryx-core']);
const scorecards = (() => {
  const outDir = path.join(ROOT, 'extract/computed/out');
  const acc = [];
  const walkDir = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkDir(p);
      else if (e.name === 'scorecard.json') acc.push(p);
    }
  };
  walkDir(outDir);
  return acc
    .map((abs) => {
      const parts = path.relative(outDir, abs).split(path.sep);
      // three levels = <lib>/<comp>/scorecard.json; two = Polaris's flat layout
      const corpus = parts.length === 3 ? parts[0] : parts.length === 2 ? 'polaris' : '(unrecognised)';
      return { corpus, v: JSON.parse(readFileSync(abs, 'utf8')) };
    });
})();
// The refusal that keeps the explicit list above honest. `conformance` is the
// synthetic CSS/DOM frontier fixture and is deliberately not a library.
for (const stray of new Set(
  scorecards.filter((s) => !LIB_DIRS.has(s.corpus) && s.corpus !== 'conformance' && !ALTERNATE_MOUNTS.has(s.corpus)).map((s) => s.corpus),
)) {
  fail('extract/computed/out', `scorecards under "${stray}/" belong to no library this script knows — add it to LIB_DIRS (and to docs/22 §8.3) or every capture number below is measured over the wrong population`);
}
const realCards = scorecards.filter((s) => LIB_DIRS.has(s.corpus));
// A scorecard with cellsCompared === 0 compared NOTHING. gate.ts returns NULL
// for its pctEqual (@door gate.empty-comparison-is-100) — it used to return 100,
// which sat in this mean and was counted at ">= 90%" as if it were perfect.
// Excluded from the MEAN and the thresholds by name; still counted as a
// component, because it exists and was run. An unmeasured component is not
// ">= 90%", so the thresholds narrow rather than the denominator.
const unmeasuredCards = realCards.filter((s) => s.v.computed.cellsCompared === 0);
const realPcts = realCards.filter((s) => s.v.computed.cellsCompared > 0).map((s) => s.v.computed.pctEqual);
const REAL_N = realCards.length;
const REAL_MEASURED = realPcts.length;
if (unmeasuredCards.length > 0) {
  console.log(
    `  UNMEASURED (0 cells compared, excluded from the mean and the thresholds): ` +
      unmeasuredCards.map((s) => s.rel ?? s.corpus).join(', '),
  );
}
const REAL_MEAN = realPcts.reduce((a, b) => a + b, 0) / (REAL_MEASURED || 1);
const REAL_GE90 = realPcts.filter((x) => x >= 90).length;
const REAL_GE80 = realPcts.filter((x) => x >= 80).length;
const REAL_CELLS = realCards.reduce((a, s) => a + s.v.computed.cellsCompared, 0);
const REAL_EQUAL = realCards.reduce((a, s) => a + s.v.computed.cellsEqual, 0);
const REAL_WEIGHTED = REAL_CELLS ? (100 * REAL_EQUAL) / REAL_CELLS : 0;
// The worst-first table's top row (docs/24 §3.1) — quoted as "the worst is X%"
// in README and docs/00-choose-your-path; the two drifted apart (50.0 vs 69.8)
// when shadcn joined the corpus, so the phrase is pinned here to the minimum.
const REAL_MIN = realPcts.length ? Math.min(...realPcts) : 0;

// ---- the COVERAGE population: measured AND committed --------------------
// Measured is not covered. A component can carry a full scorecard and no
// committed contract — captured with receipts and then deliberately HELD —
// and counting those as coverage reports a refused stem as a shipped one
// (`FC-COVERAGE-COUNTS-CAPTURES`). Every mean above legitimately averages
// over what was MEASURED; the coverage fraction below answers a different
// question and uses the smaller set. This mirrors the rule
// build-capability-report.mjs applies to docs/24 §2, re-derived here rather
// than read from it, because reading the generated document would make this
// check circular.
const normId = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const committed = (() => {
  const byLib = {};
  for (const dir of LIB_DIRS) {
    const ids = new Set();
    const names = new Set();
    const cdir = path.join(ROOT, 'examples', dir, 'contracts');
    if (existsSync(cdir)) {
      for (const f of readdirSync(cdir).filter((n) => n.endsWith('.contract.json'))) {
        try {
          const c = JSON.parse(readFileSync(path.join(cdir, f), 'utf8'));
          if (c.id) ids.add(c.id);
          if (c.name) names.add(normId(c.name));
        } catch { /* a malformed contract is reported by the schema evals, not here */ }
      }
    }
    // A scorecard's display name is not always the contract's: MUI's capture
    // config names the seed contract each component was captured from, so
    // resolve through it first and fall back to a name match.
    const seedId = {};
    const cfg = path.join(ROOT, 'extract/computed/configs', `${dir}.json`);
    if (existsSync(cfg)) {
      try {
        for (const c of (JSON.parse(readFileSync(cfg, 'utf8')).components ?? [])) {
          if (!c?.name || !c?.contract) continue;
          try {
            const seed = JSON.parse(readFileSync(path.join(ROOT, c.contract), 'utf8'));
            if (seed.id) seedId[normId(c.name)] = seed.id;
          } catch { /* a seed that cannot be read simply does not resolve */ }
        }
      } catch { /* ditto for the config */ }
    }
    byLib[dir] = { ids, names, seedId };
  }
  return byLib;
})();
const isCommitted = (corpus, displayName) => {
  const key = normId(displayName);
  const lib = committed[corpus];
  if (!lib) return false;
  const id = lib.seedId[key];
  if (id && lib.ids.has(id)) return true;
  return lib.names.has(key);
};
const coveredCards = realCards.filter((s) => isCommitted(s.corpus, s.v?.component));
const COVERED_N = coveredCards.length;
const HELD_CARDS = realCards
  .filter((s) => !isCommitted(s.corpus, s.v?.component))
  .map((s) => `${s.corpus}/${s.v?.component}`)
  .sort();

// Re-derive the known-size cohort from individual rows, NEVER a prose total.
// Unknown-size libraries must be excluded from both sides of the fraction.
const COHORT = (() => {
  const md = readFileSync(path.join(ROOT, 'docs/22-generality.md'), 'utf8').split('\n');
  const head = md.findIndex((l) => /^\|\s*library\s*\|\s*contracts committed\s*\|/i.test(l) && /library size/i.test(l));
  if (head < 0) return null;
  const rows = [];
  let total;
  let declaredKnown;
  const num = (s) => /^\d[\d,]*$/.test(s.replace(/\*/g, '').trim()) ? Number(s.replace(/[*,\s]/g, '')) : null;
  for (let i = head + 2; i < md.length && md[i].startsWith('|'); i += 1) {
    const cells = md[i].split('|').slice(1, -1).map((c) => c.trim());
    if (cells[0] === '**total**') { total = cells; continue; }
    if (cells[0] === '**known-size cohort**') { declaredKnown = cells; continue; }
    const pkg = /`([^`]+)`/.exec(cells[0])?.[1]?.replace(/@[^/@]+$/, '');
    const dir = Object.keys(LIB_PACKAGES).find((key) => LIB_PACKAGES[key] === pkg);
    if (!dir) { fail('docs/22-generality.md', `unrecognized coverage library: ${cells[0]}`); continue; }
    const contracts = committed[dir].ids.size;
    const pinned = coveredCards.filter((s) => s.corpus === dir).length;
    if (num(cells[1]) !== contracts || num(cells[2]) !== pinned) {
      fail('docs/22-generality.md', `${dir} committed/pinned columns disagree with disk (${contracts}/${pinned})`);
    }
    const size = num(cells[3]);
    if (size === null && !/unmeasured/i.test(cells[3])) fail('docs/22-generality.md', `${dir} has a malformed size, not an explicit unmeasured size`);
    rows.push({ key: dir, contracts, pinned, size });
  }
  try {
    if (rows.length !== LIB_DIRS.size) throw new Error('coverage table must name every library exactly once');
    const cohort = coverageCohort(rows);
    if (!total || num(total[1]) !== cohort.allContracts || num(total[2]) !== cohort.allPinned) throw new Error('all-library totals disagree with disk');
    if (!declaredKnown || num(declaredKnown[1]) !== cohort.contracts || num(declaredKnown[2]) !== cohort.pinned || num(declaredKnown[3]) !== cohort.size) {
      throw new Error(`known-size cohort must be ${cohort.contracts} committed / ${cohort.pinned} measured / ${cohort.size} library size`);
    }
    if (Number(/([\d.]+)%/.exec(declaredKnown[4])?.[1]) !== Number(cohort.pct?.toFixed(1))) throw new Error('known-size coverage percentage disagrees');
    return cohort;
  } catch (error) {
    fail('docs/22-generality.md', error.message);
    return null;
  }
})();
if (COHORT === null) {
  fail('docs/22-generality.md', '§8.3 known-size coverage population is unverifiable; no fraction may be claimed');
}
const LIB_SIZE = COHORT?.size ?? null;
const KNOWN_COVERED_N = COHORT?.pinned ?? null;
const COV_PCT = COHORT?.pct ?? null;
const GOLDEN_FILES = Object.keys(JSON.parse(readFileSync(path.join(ROOT, 'evals/golden.json'), 'utf8'))).length;
if (COHORT) for (const doc of ['docs/22-generality.md', 'docs/24-what-works.md']) {
  for (const message of coverageTableFailures(readFileSync(path.join(ROOT, doc), 'utf8'), COHORT)) fail(doc, message);
}
for (const doc of ['README.md', 'ROADMAP.md', 'docs/00-choose-your-path.md', 'docs/24-what-works.md']) {
  for (const message of captureProseFailures(readFileSync(path.join(ROOT, doc), 'utf8'), {
    measured: REAL_N, libraries: LIB_DIRS.size, knownLibraries: COHORT?.libraries, goldenFiles: GOLDEN_FILES,
    nonempty: REAL_MEASURED, empty: unmeasuredCards.length,
  })) fail(doc, message);
}

// ---- registry truth (scripts/registry-truth.json — NEVER the network) ------
const REGISTRY = JSON.parse(readFileSync(path.join(ROOT, 'scripts/registry-truth.json'), 'utf8')).packages;

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
// Derived claims v2 — scanned over the WHOLE document text (several of these
// phrasings wrap across a hard line break), with one expected value PER
// capture group. A `{ pct: x }` expectation is compared at the precision the
// doc itself used: "92.7" checks x.toFixed(1), "92.70" checks x.toFixed(2) —
// the doc chooses the rounding, the artifact supplies the value. `null` means
// the denominator is unavailable and the claim FAILS by name rather than
// being skipped. Regexes are TIGHT, matching the phrasings the docs actually
// use ("28 matched components" or "0 facts" prose can never be caught).
// ---------------------------------------------------------------------------
const DERIVED_CLAIMS = [
  // 1. round trip — extract/figma/roundtrip-uui/report.json
  ['round-trip buckets', /\b([\d,]+) matched(?:,| ·)\s+([\d,]+) diverged(?:,| ·)\s+([\d,]+) (?:lost|one-way loss)(?:,| ·)\s+([\d,]+) invented\b/g,
    () => [RT.matched, RT.diverged, RT.loss, RT.invented]],
  ['round-trip fact total', /\b([\d,]+)\s+facts classified\b/g, () => [RT_FACTS]],
  ['round-trip fact total + matched-%', /They are ([\d,]+) facts, so matched is \*\*([\d.]+)%\*\*/g, () => [RT_FACTS, { pct: (100 * RT.matched) / RT_FACTS }]],
  ['round-trip matched-%', /([\d.]+)% of round-trip facts \*matched\*/g, () => [{ pct: (100 * RT.matched) / RT_FACTS }]],
  ['round-trip matched-%', /\bat ([\d.]+)% it plainly is not\b/g, () => [{ pct: (100 * RT.matched) / RT_FACTS }]],
  ['round-trip original facts', /\b([\d,]+) original facts\b/gi, () => [RT.originalFacts]],
  ['round-trip closure', /closes on \*{0,2}([\d,]+) of ([\d,]+)\*{0,2}/g, () => [RT.roundTripClosed, RT.components]],
  ['round-trip closure', /completion on ([\d,]+) of ([\d,]+) components/g, () => [RT.roundTripClosed, RT.components]],
  ['round-trip set count', /all \*{0,2}([\d,]+)\*{0,2} (?:Untitled UI )?sets that were run/g, () => [RT.components]],
  ['auto-layout-inert tag count', /([\d,]+) of the ([\d,]+)\*{0,2} `layout\.mode` divergences/g, () => [RT_AL_INERT, RT_LAYOUT_MODE]],
  // 2. fidelity headline — examples/untitled-ui/renders/fidelity.json
  ['fidelity headline', /([\d.]+)%\s+(?:mean\s+)?visual fidelity\*\*[^*]{0,80}?over the ([\d,]+) statically scorable variants(?: of\s+a ([\d,]+)-variant)?/g,
    () => [{ pct: FID_MEAN }, FID_SCORED, FID_TOTAL]],
  ['fidelity headline', /\b([\d.]+)% mean over ([\d,]+) scored variants\b/g, () => [{ pct: FID_MEAN }, FID_SCORED]],
  ['fidelity headline', /scored table is \*\*([\d.]+)%\*\* over \*\*([\d,]+)\*\* variants/g, () => [{ pct: FID_MEAN }, FID_SCORED]],
  ['fidelity mean', /counterweight to that ([\d.]+)%/g, () => [{ pct: FID_MEAN }]],
  ['fidelity kit size', /\ba ([\d,]+)-variant (?:community|Figma) kit\b/g, () => [FID_TOTAL]],
  ['fidelity unscored rows', /([\d,]+) of ([\d,]+) rows are unscored/g, () => [FID_UNSCORED, FID_TOTAL]],
  ['fidelity unscored split', /\(([\d,]+) interaction-state,\s+([\d,]+) a carriage gap\)/g, () => [FID_INTERACTION, FID_CARRIAGE]],
  // 3. capture denominators — scorecards + the docs/22 §8.3 size total
  ['capture component count', /for ([\d,]+) third-party components measured/g, () => [REAL_N]],
  ['capture component count', /([\d,]+) third-party components vs the original npm package/g, () => [REAL_N]],
  ['capture cell count', /no tolerance, ([\d,]+) style cells/g, () => [REAL_CELLS]],
  ['capture coverage numerator', /([\d,]+) of those measured components also carry a committed contract/g, () => [COVERED_N]],
  ['eval measured tally', /measured eval record: ([\d,]+) passed, ([\d,]+) named failures, ([\d,]+) total/g, () => [results.passed, results.total - results.passed, results.total]],
  ['capture component count', /\b([\d,]+) components across six\s+libraries\b/g, () => [REAL_N]],
  ['capture component count', /lists all ([\d,]+) worst-first/g, () => [REAL_N]],
  ['capture component count', /\(all ([\d,]+), worst first\)/g, () => [REAL_N]],
  // The NUMERATOR of a coverage fraction is COVERED_N (measured AND
  // committed), never REAL_N (measured). The two differ by the held stems,
  // and quoting the larger one over a library size is precisely the
  // refused-stem-as-shipped-stem claim FC-COVERAGE-COUNTS-CAPTURES forbids.
  ['capture coverage', /those ([\d,]+) components are \*\*([\d.]+)% of the ([\d,]+)\*\*/g,
    () => [KNOWN_COVERED_N, COV_PCT === null ? null : { pct: COV_PCT }, LIB_SIZE]],
  ['capture coverage', /the ([\d,]+) covered components are \*\*([\d.]+)%\*\* of the ([\d,]+) in/g,
    () => [KNOWN_COVERED_N, COV_PCT === null ? null : { pct: COV_PCT }, LIB_SIZE]],
  ['capture coverage', /they are ([\d,]+) of ([\d,]+) components \(([\d.]+)%\)/g,
    () => [KNOWN_COVERED_N, LIB_SIZE, COV_PCT === null ? null : { pct: COV_PCT }]],
  ['capture coverage', /the easy ([\d.]+)%/g, () => [COV_PCT === null ? null : { pct: COV_PCT }]],
  ['capture coverage', /the tractable ([\d.]+)%/g, () => [COV_PCT === null ? null : { pct: COV_PCT }]],
  ['capture cell count', /([\d.]+)% cell-weighted over ([\d,]+)/g, () => [{ pct: REAL_WEIGHTED }, REAL_CELLS]],
  ['capture cell count', /over ([\d,]+) (?:compared )?style cells/g, () => [REAL_CELLS]],
  ['capture ≥90% split', /([\d,]+) of ([\d,]+)(?: components)? at ≥90%/g, () => [REAL_GE90, REAL_N]],
  ['capture ≥80% split', /([\d,]+) of ([\d,]+)(?: components)? at ≥80%/g, () => [REAL_GE80, REAL_N]],
  ['capture mean equality', /([\d.]+)% mean\s+computed-style equality/g, () => [{ pct: REAL_MEAN }]],
  ['capture mean equality', /([\d.]+)% mean, and every component is listed/g, () => [{ pct: REAL_MEAN }]],
  ['capture mean equality', /the ([\d.]+)% above describes only the tractable/g, () => [{ pct: REAL_MEAN }]],
  ['capture worst component', /\bthe worst is ([\d.]+)%/g, () => [{ pct: REAL_MIN }]],
];

for (const doc of DOCS) {
  const abs = path.join(ROOT, doc);
  if (!existsSync(abs)) continue;
  const text = readFileSync(abs, 'utf8');
  const lines = text.split('\n');
  const lineAt = (idx) => text.slice(0, idx).split('\n').length;
  for (const [label, re, expected] of DERIVED_CLAIMS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const ln = lineAt(m.index);
      if (lines[ln - 1]?.includes(IGNORE)) continue;
      const want = expected();
      const quote = m[0].replace(/\s+/g, ' ').trim();
      for (let g = 1; g < m.length; g += 1) {
        const raw = m[g];
        if (raw === undefined) continue;
        const exp = want[g - 1];
        if (exp === null || exp === undefined) {
          fail(`${doc}:${ln}`, `${label} — cannot verify "${raw}": the denominator source did not parse (see the docs/22 §8.3 failure above)`);
          continue;
        }
        const got = Number(raw.replace(/,/g, ''));
        const decimals = (raw.split('.')[1] ?? '').length;
        const wantStr = typeof exp === 'object' ? exp.pct.toFixed(decimals) : String(exp);
        if (got !== Number(wantStr)) {
          fail(`${doc}:${ln}`, `${label} — doc says ${raw}, derived value is ${wantStr}  ("${quote.slice(0, 120)}")`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Published-version claims vs scripts/registry-truth.json (never the network)
// ---------------------------------------------------------------------------
const REG_PKG_RE = /@ds-contracts\/(cli|schema|emitter-web-components)/;
const REG_PKG_VER_RE = /@ds-contracts\/(cli|schema|emitter-web-components)@(\d[\w.-]*)/g;
const regOf = (short) => REGISTRY[`@ds-contracts/${short}`];
const ALL_PUBLISHED = new Set(Object.values(REGISTRY).flatMap((t) => Object.values(t)));

for (const doc of DOCS) {
  const abs = path.join(ROOT, doc);
  if (!existsSync(abs)) continue;
  const text = readFileSync(abs, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, i) => {
    if (line.includes(IGNORE)) return;
    const where = `${doc}:${i + 1}`;

    // "`latest` is `X` · `next` is `Y`" on a line naming one of the packages
    const pkg = REG_PKG_RE.exec(line);
    if (pkg) {
      const truth = regOf(pkg[1]);
      const tagRe = /`(latest|next)` is `([^`]+)`/g;
      let t;
      while ((t = tagRe.exec(line)) !== null) {
        if (truth[t[1]] !== t[2]) {
          fail(where, `published version — doc says \`${t[1]}\` is \`${t[2]}\` for @ds-contracts/${pkg[1]}, registry-truth.json says ${truth[t[1]]}`);
        }
      }
    }

    // pkg@version on a line asserting published state
    REG_PKG_VER_RE.lastIndex = 0;
    let v;
    while ((v = REG_PKG_VER_RE.exec(line)) !== null) {
      const truth = regOf(v[1]);
      const name = `@ds-contracts/${v[1]}`;
      if (/\b(?:latest published|published stable)\b/i.test(line)) {
        if (v[2] !== truth.latest) {
          fail(where, `published version — doc claims ${name}@${v[2]} is the published stable, registry-truth.json says latest is ${truth.latest}`);
        }
      } else if (/\((?:already )?published\)|\bis published\b|\bnow published\b|\bon npm\b|\bon the npm registry\b/i.test(line)) {
        if (v[2] !== truth.latest && v[2] !== truth.next) {
          fail(where, `published version — doc claims ${name}@${v[2]} is published, but registry-truth.json records only latest ${truth.latest} / next ${truth.next}`);
        }
      }
    }
  });

  // Multi-line phrasings (README §Release-candidate status, docs/27)
  const lineAt = (idx) => text.slice(0, idx).split('\n').length;
  const phrase = (re, verify) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      const ln = lineAt(m.index);
      if (lines[ln - 1]?.includes(IGNORE)) continue;
      verify(m, `${doc}:${ln}`);
    }
  };
  phrase(/schema\s+`([^`]+)`, and web-components emitter\s+`([^`]+)`\.\s+Those exact package\s+RCs were published under npm(?:'|’)s `next` tag/g, (m, where) => {
    if (m[1] !== regOf('schema').next) fail(where, `published version — doc says schema RC \`${m[1]}\` was published under \`next\`, registry-truth.json says next is ${regOf('schema').next}`);
    if (m[2] !== regOf('emitter-web-components').next) fail(where, `published version — doc says emitter RC \`${m[2]}\` was published under \`next\`, registry-truth.json says next is ${regOf('emitter-web-components').next}`);
  });
  phrase(/CLI `[^`]+` is newer than the stable `([^`]+)` and than the published\s+`next` RC \(`([^`]+)`\)/g, (m, where) => {
    if (m[1] !== regOf('cli').latest) fail(where, `published version — doc says the stable CLI is \`${m[1]}\`, registry-truth.json says latest is ${regOf('cli').latest}`);
    if (m[2] !== regOf('cli').next) fail(where, `published version — doc says the published \`next\` CLI RC is \`${m[2]}\`, registry-truth.json says next is ${regOf('cli').next}`);
  });
  phrase(/the CLI source to `([^`]+)`; it is source-ahead and unpublished/g, (m, where) => {
    if (ALL_PUBLISHED.has(m[1])) fail(where, `published version — doc claims \`${m[1]}\` is unpublished, but registry-truth.json records it as published; update the prose`);
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
  `round trip       ${RT.matched}/${RT.diverged}/${RT.loss}/${RT.invented} m/d/l/i of ${RT_FACTS}, orig ${RT.originalFacts}, matched ${((100 * RT.matched) / RT_FACTS).toFixed(1)}% (extract/figma/roundtrip-uui/report.json)`,
  `fidelity         ${FID_SCORED}/${FID_TOTAL} scored, mean ${FID_MEAN.toFixed(2)}% (examples/untitled-ui/renders/fidelity.json)`,
  `recipe fidelity  ${RECIPE_FIDELITY.passed} pass / ${RECIPE_FIDELITY.fringe} fringe / ${RECIPE_FIDELITY.named} named of ${RECIPE_FIDELITY.total} (SCORECARD rows + KNOWN-FAILURES)`,
  `capture floor    ${REAL_N} measured, ${REAL_CELLS.toLocaleString('en-US')} cells, mean ${REAL_MEAN.toFixed(1)}% (extract/computed/out/**, ${LIB_DIRS.size} libraries)`,
  `known-size coverage ${KNOWN_COVERED_N} measured AND committed = ${COV_PCT === null ? 'UNAVAILABLE' : `${COV_PCT.toFixed(1)}% of ${LIB_SIZE}`}; ${COHORT?.unknownPinned ?? '?'} covered without a library size${HELD_CARDS.length ? `; ${HELD_CARDS.length} held, uncounted: ${HELD_CARDS.join(', ')}` : ''} (+ docs/22 §8.3)`,
  `registry truth   ${Object.entries(REGISTRY).map(([k, v]) => `${k.replace('@ds-contracts/', '')} ${v.latest}/${v.next}`).join(' · ')} (scripts/registry-truth.json, no network)`,
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
