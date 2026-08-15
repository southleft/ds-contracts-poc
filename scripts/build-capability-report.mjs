#!/usr/bin/env node
/**
 * THE CAPABILITY REPORT — `npm run capability:report` (`--check` to verify).
 *
 * Builds `docs/24-what-works.md`: the success-side counterpart to the 1,179-line
 * `docs/23-known-limitations.md`. Until now every win in this repo existed as a
 * number inside a JSON file nobody reads, while every loss had a document with
 * a table of contents. That asymmetry is not honesty; it is a different bias.
 *
 * THIS IS THE MOST DANGEROUS ARTIFACT IN THE REPO, and it is built accordingly.
 * It is a machine whose OUTPUT IS FLATTERING NUMBERS. A flattering number with
 * no denominator is marketing, and a receipt naming a wrong destination is
 * worse than no receipt at all. So it inherits the rule of
 * `extract/figma/ledger/residuals.ts` verbatim:
 *
 *   IT AGGREGATES. Every number in the output is READ from a committed
 *   artifact. Nothing is typed in. Where a source cannot answer, this file
 *   SAYS SO instead of estimating — §7 is a list of exactly that.
 *
 * The only hand-authored content is LABELS and the LIBRARY REGISTRY: the
 * mapping from a directory name to the human label and package id already
 * written in docs/22 §8.3. The registry contains no measurements.
 *
 * THREE STRUCTURAL DEFENCES, because a success document is the one place where
 * a silently-wrong number does the most damage:
 *
 *   1. THE DENOMINATOR IS PRINTED BEFORE THE MEANS, NOT AFTER, and repeated
 *      inline under every table that averages over captured components. §2 runs
 *      first for that reason. A mean over a slice chosen for tractability is a
 *      statement about the slice; a success doc that omits which slice is the
 *      worst thing this repo could ship.
 *   2. EVERY NUMBER CARRIES ITS SOURCE PATH, in the table's own `source`
 *      column or in the sources ledger in §9. A number with no source is a
 *      defect in this file.
 *   3. CROSS-CHECKS ARE COMPUTED, NOT ASSERTED (§8). Two independent artifacts
 *      that ought to agree are compared, and a disagreement is PRINTED IN THE
 *      DOCUMENT rather than resolved in favour of the nicer figure.
 *
 * A DEFECT THIS FILE FOUND WHILE BEING WRITTEN, kept here because it is the
 * exact failure mode the file exists to prevent: the obvious glob for the
 * computed corpus, `extract/computed/out/<lib>/<comp>/scorecard.json`, silently
 * MISSES POLARIS. Polaris's twelve components were captured before the corpus
 * grew a per-library directory level, so they live one level up at
 * `extract/computed/out/<comp>/scorecard.json`. The brief for this file, and
 * any reader repeating the obvious glob, gets 42 components across five
 * libraries and a mean of 89.63. The true corpus is 54 across six, mean 89.57.
 * The mean barely moved; a whole vendor had vanished. That is why §8 checks the
 * component count against a SECOND artifact that counts the same corpus a
 * different way (docs/22 §8.3's "pinned by the drift instrument" column).
 *
 * DETERMINISM: no clock, no HEAD, no environment; every collection is sorted
 * before rendering. Two runs over unchanged sources are byte-identical, which
 * is what `--check` enforces.
 *
 * SOURCES (all committed):
 *   extract/computed/out/**\/scorecard.json         computed-equality per component
 *   extract/computed/out/**\/numbers.json           capture counts + determinism receipts
 *   examples/untitled-ui/renders/fidelity.json      canvas→code visual fidelity (scored table)
 *   extract/figma/roundtrip-uui/report.json         canvas→code→canvas fact accounting
 *   extract/figma/dagger-census.json                dropped-fact receipts per corpus
 *   extract/figma/conformance/MANIFEST.json         canvas construct vocabulary
 *   conformance/MANIFEST.json                       CSS/DOM frontier vocabulary
 *   evals/results.json                              the executable claim suite
 *   evals/golden.json                               the byte-identical generation pin
 *   docs/22-generality.md §8.3                      the coverage denominators
 *   contracts/ and examples/<lib>/contracts/        the committed contract corpus
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', '24-what-works.md');
const OUT_NAME = 'docs/24-what-works.md';
const BUILD_CMD = 'npm run capability:report';

/* -------------------------------------------------------------- utilities */

const sources = [];
const track = (label, abs, text) => {
  sources.push({
    label,
    rel: path.relative(ROOT, abs).split(path.sep).join('/'),
    hash: createHash('sha256').update(text).digest('hex').slice(0, 12),
    bytes: Buffer.byteLength(text),
  });
};
const readText = (label, abs) => {
  const t = readFileSync(abs, 'utf8');
  track(label, abs, t);
  return t;
};
const readJson = (label, abs) => JSON.parse(readText(label, abs));

/** Read a sorted set of JSON files as ONE tracked source (one hash over all).
 *  `glob` is the path pattern printed in the sources ledger; it must be the
 *  pattern that actually matched, never a tidier one. */
function readGroup(glob, label, absPaths) {
  const list = absPaths.slice().sort();
  const h = createHash('sha256');
  let bytes = 0;
  const out = [];
  for (const abs of list) {
    const text = readFileSync(abs, 'utf8');
    h.update(path.relative(ROOT, abs)).update('\0').update(text).update('\0');
    bytes += Buffer.byteLength(text);
    out.push({ abs, rel: path.relative(ROOT, abs).split(path.sep).join('/'), value: JSON.parse(text) });
  }
  sources.push({ label: `${label} — ${list.length} files`, rel: glob, hash: h.digest('hex').slice(0, 12), bytes });
  return out;
}

/** Recursive file walk, sorted at every level. Deterministic ordering. */
function walk(dir, match, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, match, acc);
    else if (match(e.name)) acc.push(p);
  }
  return acc;
}

const fmt = (n) => n.toLocaleString('en-US');
const f1 = (n) => n.toFixed(1);
const f2 = (n) => n.toFixed(2);
const pct = (num, den) => (den === 0 ? null : (100 * num) / den);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
const table = (headers, rows) => [
  `| ${headers.join(' | ')} |`,
  `|${headers.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.join(' | ')} |`),
];
const L = [];
const P = (...lines) => { L.push(...lines, ''); };

/** A QUESTION NO COMMITTED ARTIFACT CAN ANSWER. Registering one is the only
 *  sanctioned way for this build to leave a number out: it becomes a row in §7
 *  with the reason attached. Silently omitting the question instead would read
 *  as "nothing to report", which is a stronger claim than the evidence. */
const notAnswered = [];
const cannotAnswer = (question, why) => { notAnswered.push({ question, why }); };

/* --------------------------------------------------------- hand-authored */
/* LABELS ONLY. Every number beside these comes from an artifact. The package
 * ids are the ones docs/22 §8.3 already prints; they are matched against that
 * table's rows in §8 and a mismatch is reported rather than papered over. */
const LIBRARIES = [
  { dir: 'altitude', label: 'Altitude', pkg: 'altitude-web-components@1.0.2', contracts: 'examples/altitude/contracts' },
  { dir: 'astryx', label: 'Astryx', pkg: '@astryxdesign/core@0.1.6', contracts: 'examples/astryx/contracts' },
  { dir: 'carbon', label: 'Carbon', pkg: '@carbon/react@1.112.0', contracts: 'examples/carbon/contracts' },
  { dir: 'mui', label: 'MUI', pkg: '@mui/material@9.2.0', contracts: 'examples/mui/contracts' },
  { dir: 'polaris', label: 'Polaris', pkg: '@shopify/polaris@13.9.5', contracts: 'examples/polaris/contracts' },
  // shadcn is copy-in source, not an npm package — the pkg id is the sandbox
  // barrel; the real pin is the vendored-source sha256 ledger in
  // examples/shadcn/RECON.md §2.2 (fetched via shadcn CLI 4.16.2, radix-vega).
  { dir: 'shadcn', label: 'shadcn/ui', pkg: '@shadcn-sandbox/ui@0.0.1', contracts: 'examples/shadcn/contracts' },
  { dir: 'tailwind', label: 'Flowbite / Tailwind', pkg: 'flowbite-react@0.12.17', contracts: 'examples/tailwind/contracts' },
  // Fluent 2 is npm-pinned, but the SUITE package pins its 64 siblings by caret
  // range, so the real pin is examples/fluent/sandbox.package-lock.json (sha256
  // in examples/fluent/PROVENANCE.md) — the same reasoning as shadcn's ledger.
  { dir: 'fluent', label: 'Fluent 2', pkg: '@fluentui/react-components@9.74.5', contracts: 'examples/fluent/contracts' },
];

/* ==================================================================== READ */

/* ---- the computed corpus: scorecards + numbers -------------------------- */
const OUTDIR = path.join(ROOT, 'extract', 'computed', 'out');
const allScorecards = walk(OUTDIR, (n) => n === 'scorecard.json');
const allNumbers = walk(OUTDIR, (n) => n === 'numbers.json');

/** Classify a scorecard path into { corpus, component }. The corpus is either a
 *  library directory, the literal `conformance` synthetic fixture, or — for the
 *  paths with no library level at all — Polaris, which predates that level. */
const LIB_DIRS = new Set(LIBRARIES.map((l) => l.dir));
function classify(abs) {
  const parts = path.relative(OUTDIR, abs).split(path.sep);
  if (parts.length === 3) return { corpus: parts[0], component: parts[1] };
  if (parts.length === 2) return { corpus: 'polaris', component: parts[0], flat: true };
  return { corpus: '(unrecognised layout)', component: parts.join('/') };
}

const scorecards = readGroup('extract/computed/out/**/scorecard.json', 'computed-equality per component', allScorecards)
  .map((f) => ({ ...classify(f.abs), rel: f.rel, v: f.value }));
const numbers = readGroup('extract/computed/out/**/numbers.json', 'capture counts + determinism receipts', allNumbers)
  .map((f) => ({ ...classify(f.abs), rel: f.rel, v: f.value }));

const realCards = scorecards.filter((s) => LIB_DIRS.has(s.corpus)).sort((a, b) => a.rel.localeCompare(b.rel));
const confCards = scorecards.filter((s) => s.corpus === 'conformance').sort((a, b) => a.rel.localeCompare(b.rel));
const strayCards = scorecards.filter((s) => !LIB_DIRS.has(s.corpus) && s.corpus !== 'conformance');

const pctOf = (s) => s.v.computed.pctEqual;
const realPcts = realCards.map(pctOf);
const REAL_N = realCards.length;
const REAL_MEAN = mean(realPcts);
const REAL_MEDIAN = median(realPcts);
const REAL_GE90 = realPcts.filter((x) => x >= 90).length;
const REAL_GE80 = realPcts.filter((x) => x >= 80).length;
const REAL_CELLS = realCards.reduce((a, s) => a + s.v.computed.cellsCompared, 0);
const REAL_EQUAL = realCards.reduce((a, s) => a + s.v.computed.cellsEqual, 0);
const REAL_WEIGHTED = pct(REAL_EQUAL, REAL_CELLS);
const REAL_ROWS = realCards.reduce((a, s) => a + s.v.computed.rows, 0);
const REAL_ROWS_EQ = realCards.reduce((a, s) => a + s.v.computed.rowsFullyEqual, 0);

const CONF_N = confCards.length;
const CONF_MEAN = mean(confCards.map(pctOf));
const CONF_CELLS = confCards.reduce((a, s) => a + s.v.computed.cellsCompared, 0);
const CONF_EQUAL = confCards.reduce((a, s) => a + s.v.computed.cellsEqual, 0);

/* captures + the determinism receipt each capture run wrote */
const CAPTURES = numbers.reduce((a, n) => a + (n.v.captures ?? 0), 0);
const DET_PHRASE = 'byte-identical across two full sweeps in one session';
const detOk = numbers.filter((n) => n.v.determinism === DET_PHRASE).length;
const detOther = numbers.filter((n) => n.v.determinism !== DET_PHRASE)
  .map((n) => `${n.rel}: ${n.v.determinism ?? '(absent)'}`).sort();

/* ---- the committed contract corpus ------------------------------------- */
const countContracts = (relDir) => {
  const abs = path.join(ROOT, relDir);
  if (!existsSync(abs)) return 0;
  return readdirSync(abs).filter((f) => f.endsWith('.contract.json')).length;
};
const OWN_CONTRACTS = countContracts('contracts');
const UUI_CONTRACTS = countContracts('examples/untitled-ui/storybook/contracts');
const EVENTZ_CONTRACTS = countContracts('examples/eventz-vars/contracts');
const libContracts = Object.fromEntries(LIBRARIES.map((l) => [l.dir, countContracts(l.contracts)]));
const FOREIGN_CONTRACTS = Object.values(libContracts).reduce((a, b) => a + b, 0);

/* ---- FC-COVERAGE-COUNTS-CAPTURES ---------------------------------------
 * A scorecard proves a component was MEASURED. It does not prove a contract
 * was committed for it, and the two are not the same population: a stem can be
 * captured with full receipts and then deliberately HELD (Flowbite's Blockquote,
 * Spinner and TextInput all are). Counting scorecard directories as coverage
 * therefore counts REFUSED stems as shipped ones — and because it once held for
 * every library that measured == committed, the inversion stayed invisible until
 * a lane carried holds, at which point Flowbite read 11-of-8 and 23.9%.
 *
 * The link from a scorecard back to a contract is not the directory name: MUI
 * captures TablePagination under the display name "Pagination", so no filename
 * or contract-name match can reach it. The authority is the capture config,
 * which says which SEED each captured component came from; that seed's `id` is
 * the same id the committed contract carries. Resolve through it, and fall back
 * to a normalised contract-name match so a library with no config degrades to a
 * weaker rule rather than silently reading zero. */
const normId = (s) => String(s ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
const committedIdsByLib = {};
const committedNamesByLib = {};
const seedIdByDisplayName = {};
for (const l of LIBRARIES) {
  const abs = path.join(ROOT, l.contracts);
  const ids = new Set();
  const names = new Set();
  if (existsSync(abs)) {
    for (const f of readdirSync(abs).filter((n) => n.endsWith('.contract.json'))) {
      try {
        const c = JSON.parse(readFileSync(path.join(abs, f), 'utf8'));
        if (c.id) ids.add(c.id);
        if (c.name) names.add(normId(c.name));
      } catch { /* a malformed contract is already reported by other sections */ }
    }
  }
  committedIdsByLib[l.dir] = ids;
  committedNamesByLib[l.dir] = names;

  const map = {};
  const cfgPath = path.join(ROOT, 'extract', 'computed', 'configs', `${l.dir}.json`);
  if (existsSync(cfgPath)) {
    try {
      const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
      for (const c of cfg.components ?? []) {
        if (!c?.name || !c?.contract) continue;
        try {
          const seed = JSON.parse(readFileSync(path.join(ROOT, c.contract), 'utf8'));
          if (seed.id) map[normId(c.name)] = seed.id;
        } catch { /* a seed that cannot be read simply does not resolve */ }
      }
    } catch { /* ditto for the config */ }
  }
  seedIdByDisplayName[l.dir] = map;
}
/** Does this scorecard correspond to a contract that is actually COMMITTED? */
const hasCommittedContract = (corpus, displayName) => {
  const key = normId(displayName);
  const id = seedIdByDisplayName[corpus]?.[key];
  if (id && committedIdsByLib[corpus]?.has(id)) return true;
  return Boolean(committedNamesByLib[corpus]?.has(key));
};
/* The coverage population: measured AND committed. Every fidelity mean below
 * still averages over `realCards` — those numbers legitimately describe what was
 * measured — but COVERAGE answers a different question and uses this set. */
const coveredCards = realCards.filter((s) => hasCommittedContract(s.corpus, s.v?.component));
const COVERED_N = coveredCards.length;
const HELD_CARDS = realCards
  .filter((s) => !hasCommittedContract(s.corpus, s.v?.component))
  .map((s) => `${s.corpus}/${s.v?.component ?? s.component}`)
  .sort();

/* ---- the coverage denominators, parsed out of docs/22 §8.3 -------------- */
/* The library SIZE denominators are not in any JSON in this repo: they were
 * produced by one-off extractor runs and recorded in prose. Rather than retype
 * them (which would make this file the second, drifting copy), the committed
 * document is READ and its table parsed. If the parse fails, §2 says so. */
const gen22 = readText('coverage denominators (docs/22 §8.3 table)', path.join(ROOT, 'docs', '22-generality.md'));
function parseCoverageTable(md) {
  const lines = md.split('\n');
  const head = lines.findIndex((l) => /^\|\s*library\s*\|\s*contracts committed\s*\|/i.test(l) && /library size/i.test(l));
  if (head < 0) return null;
  const rows = [];
  for (let i = head + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cells.length < 5) break;
    const num = (s) => { const m = /(\d[\d,]*)/.exec(s.replace(/\*/g, '')); return m ? Number(m[1].replace(/,/g, '')) : null; };
    rows.push({ raw: cells[0], pkg: (/`([^`]+)`/.exec(cells[0]) ?? [])[1] ?? null, contracts: num(cells[1]), pinned: num(cells[2]), size: num(cells[3]) });
  }
  return rows.length ? rows : null;
}
const covRows = parseCoverageTable(gen22);
const coverage = new Map();
let COV_TOTAL = null;
if (covRows) {
  for (const r of covRows) {
    if (/^\*\*total\*\*$/i.test(r.raw) || /^total$/i.test(r.raw)) { COV_TOTAL = r; continue; }
    const lib = LIBRARIES.find((l) => r.pkg === l.pkg);
    if (lib) coverage.set(lib.dir, r);
  }
} else {
  cannotAnswer('the per-library coverage fraction', 'the §8.3 table in `docs/22-generality.md` did not parse — its header changed. No fraction is printed rather than a guessed one.');
}

/* ---- Untitled UI canvas→code visual fidelity ---------------------------- */
const FID_PATH = path.join(ROOT, 'examples', 'untitled-ui', 'renders', 'fidelity.json');
const fid = readJson('Untitled UI scored fidelity table', FID_PATH);
const fidScored = fid.filter((r) => typeof r.score === 'number');
const fidNull = fid.filter((r) => typeof r.score !== 'number');
const FID_MEAN = mean(fidScored.map((r) => r.score));
const fidNullReasons = [...fidNull.reduce((m, r) => m.set(r.note ?? '(no note)', (m.get(r.note ?? '(no note)') ?? 0) + 1), new Map())]
  .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
const fidBySet = new Map();
for (const r of fidScored) {
  if (!fidBySet.has(r.set)) fidBySet.set(r.set, []);
  fidBySet.get(r.set).push(r.score);
}
const fidSets = [...fidBySet]
  .map(([set, xs]) => ({ set, n: xs.length, mean: mean(xs) }))
  .sort((a, b) => b.mean - a.mean || a.set.localeCompare(b.set));

/* ---- canvas → code → canvas round trip ---------------------------------- */
const rt = readJson('canvas→code→canvas round trip', path.join(ROOT, 'extract', 'figma', 'roundtrip-uui', 'report.json'));
const RT = rt.totals;
const RT_FACTS = RT.matched + RT.diverged + RT.loss + RT.invented;
const tagCensus = (key) => {
  const m = new Map();
  for (const r of rt.results) for (const f of r[key] ?? []) m.set(f.tag ?? '(untagged)', (m.get(f.tag ?? '(untagged)') ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
};
const divTags = tagCensus('diverged');
const lossTags = tagCensus('loss');
const invTags = tagCensus('invented');
const AL_INERT = (divTags.find(([t]) => t === 'auto-layout-inert') ?? [null, 0])[1];
const LAYOUT_MODE_DIVERGED = rt.results.reduce((a, r) => a + r.diverged.filter((f) => f.channel === 'layout.mode').length, 0);

/* ---- the executable claim suite ----------------------------------------- */
const evals = readJson('executable claim suite', path.join(ROOT, 'evals', 'results.json'));
const byClaim = [...evals.results.reduce((m, r) => {
  const k = r.claim ?? '(unclassified)';
  const e = m.get(k) ?? { total: 0, passed: 0 };
  e.total += 1; if (r.pass) e.passed += 1;
  return m.set(k, e);
}, new Map())].sort((a, b) => a[0].localeCompare(b[0]));

/* ---- byte-identical generation pin -------------------------------------- */
const golden = readJson('generated-source golden manifest', path.join(ROOT, 'evals', 'golden.json'));
const GOLDEN_FILES = Object.keys(golden).length;

/* ---- the honesty instruments -------------------------------------------- */
const dagger = readJson('dropped-fact receipt census', path.join(ROOT, 'extract', 'figma', 'dagger-census.json')).census;
const daggerRows = Object.entries(dagger).map(([corpus, m]) => ({
  corpus,
  receipts: Object.values(m).reduce((a, b) => a + b, 0),
  contracts: Object.keys(m).length,
})).sort((a, b) => b.receipts - a.receipts || a.corpus.localeCompare(b.corpus));
const DAGGER_TOTAL = daggerRows.reduce((a, r) => a + r.receipts, 0);

const canvasMan = readJson('canvas construct vocabulary', path.join(ROOT, 'extract', 'figma', 'conformance', 'MANIFEST.json'));
const canvasByExpect = [...canvasMan.cases.reduce((m, c) => m.set(c.expect, (m.get(c.expect) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const canvasByStatus = [...canvasMan.cases.reduce((m, c) => m.set(c.status ?? '(none)', (m.get(c.status ?? '(none)') ?? 0) + 1), new Map())].sort((a, b) => a[0].localeCompare(b[0]));

const cssMan = readJson('CSS/DOM frontier vocabulary', path.join(ROOT, 'conformance', 'MANIFEST.json'));
const cssByExpect = Object.entries(cssMan.byExpectation).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/* ---- receipts that exist only on a console ------------------------------ */
/* `paste:check` and `plugin:check` are real gates that run in the eval suite,
 * but neither writes a machine-readable artifact — both assert against strings
 * printed to stdout. There is therefore nothing here to aggregate, and this
 * file will not transcribe a console. */
const consoleOnly = [
  ['`npm run paste:check`', 'extract/figma/paste-door-check.ts', 'asserts on stdout; writes no artifact'],
  ['`npm run plugin:check`', 'scripts/plugin-engine-check.mjs', 'asserts on stdout; writes no artifact'],
].sort((a, b) => a[0].localeCompare(b[0]));
for (const [cmd, file] of consoleOnly) {
  cannotAnswer(`a pass/fail count for ${cmd}`, `\`${file}\` asserts against strings it prints and writes no machine-readable receipt. Its result is a green or red exit code inside \`npm run eval\`, counted there and nowhere else. This document does not transcribe a console.`);
}

/* ==================================================================== §8 */
/* CROSS-CHECKS. Two artifacts that must agree, compared. A disagreement is
 * printed in the document; it is never resolved toward the nicer number. */
const checks = [];
const check = (question, a, b, aSrc, bSrc) => {
  checks.push({ question, a, b, agree: String(a) === String(b), aSrc, bSrc });
};
check(
  'components measured AND backed by a committed contract = components pinned by the drift instrument',
  COVERED_N,
  COV_TOTAL?.pinned ?? '(table did not parse)',
  'extract/computed/out/**/scorecard.json ∩ examples/*/contracts/*.contract.json',
  'docs/22-generality.md §8.3, "pinned" total',
);
check(
  'contracts committed under `examples/<lib>/contracts` = the coverage table\'s committed column',
  FOREIGN_CONTRACTS,
  COV_TOTAL?.contracts ?? '(table did not parse)',
  'examples/*/contracts/*.contract.json',
  'docs/22-generality.md §8.3, "contracts committed" total',
);
// THE PASS COUNT IS DELIBERATELY NOT QUOTED — IT OSCILLATES.
// This document is itself gated by an eval (capability-report-is-fresh), and
// that eval's own result is written into evals/results.json by the run that
// executes it. Quoting `passed` therefore makes the document permanently one
// run behind its own source: green run -> results says N/N -> rebuild differs
// from the committed copy -> next run red -> results says N-1/N -> rebuild
// differs again. Observed oscillating across three consecutive full suites
// (2026-08-03). Only the SUITE SIZE and the per-class composition are stable
// facts about the suite; whether the committed run is GREEN is already gated,
// harder, by scripts/docs-numbers-check.mjs, which fails outright when
// results.json records a red run. One owner per fact.
// (the greenness cross-check moved to docs-numbers-check.mjs, which owns it)
check('the eval suite has as many result rows as it claims', evals.results.length, evals.total, 'evals/results.json → results.length', 'same file → total');
check('every capture run carries the two-sweep determinism receipt', detOk, numbers.length, 'extract/computed/out/**/numbers.json', 'count of numbers.json files');
check('every scorecard falls in a known corpus', strayCards.length, 0, 'extract/computed/out/**/scorecard.json', 'the library registry in this script');
check('every round-trip execution reached the fact diff', RT.roundTripClosed, RT.components, 'extract/figma/roundtrip-uui/report.json → totals.roundTripClosed', 'same file → totals.components');
for (const lib of LIBRARIES) {
  const cov = coverage.get(lib.dir);
  if (!cov) continue;
  // FC-COVERAGE-COUNTS-CAPTURES: the §8.3 "pinned" column is scoped "OF THOSE
  // [committed]", so the artifact side of this check must be scoped the same
  // way. Comparing every scorecard against it counted HELD stems as pinned.
  const rows = coveredCards.filter((s) => s.corpus === lib.dir);
  check(
    `${lib.label} — contracts on disk = the coverage table's committed column`,
    libContracts[lib.dir], cov.contracts,
    `${lib.contracts}/*.contract.json`, 'docs/22-generality.md §8.3',
  );
  check(
    `${lib.label} — components measured AND committed = the coverage table's pinned column`,
    rows.length, cov.pinned,
    // THE DIRECTORY THE FILES ARE ACTUALLY IN. Printing
    // `extract/computed/out/polaris/` here would be a receipt naming a
    // destination that does not exist — Polaris predates the per-library level
    // and its scorecards sit one directory up. A wrong path in a receipt is
    // worse than no receipt, so this is derived from the matched files.
    rows.length ? `extract/computed/out/${rows[0].flat ? '<comp>' : `${lib.dir}/<comp>`}/scorecard.json` : `extract/computed/out/${lib.dir}/ (no files matched)`,
    'docs/22-generality.md §8.3',
  );
}
const CHECKS_FAILED = checks.filter((c) => !c.agree);

/* ================================================================== RENDER */

const COVERAGE_CAVEAT =
  `**Read every percentage on this page as "on the easy ${COV_TOTAL ? f1(pct(COV_TOTAL.pinned, COV_TOTAL.size)) : '?'}%."** ` +
  `The ${fmt(REAL_N)} components measured here were chosen because they were **tractable**, not at random — ` +
  `they are Button, Badge, Chip, Card, Checkbox, Tag, Avatar, Divider and their siblings. ` +
  `Across the ${LIBRARIES.length} libraries they are ${fmt(COV_TOTAL?.pinned ?? REAL_N)} of ${fmt(COV_TOTAL?.size ?? 0)} components ` +
  `(${COV_TOTAL ? f1(pct(COV_TOTAL.pinned, COV_TOTAL.size)) : '?'}%). Data grid, tree, virtualized list, date picker, rich text and charts ` +
  `appear in **zero** committed contracts. A mean over this slice is a statement about this slice.`;

P('# 24 — What Works');
P('*The success-side counterpart to [23 — Known Limitations](23-known-limitations.md). Written for a design engineer deciding whether to adopt this: what is **proven**, and **how it was measured**.*');
P(`> **This file is generated. Do not edit it.** \`${BUILD_CMD}\` rebuilds it; \`npm run capability:fresh\` refuses if the committed bytes differ from a rebuild, and one of the ${fmt(evals.total)} evals runs that refusal.`);

P(
  'This is the most dangerous document in the repository, because its output is',
  'flattering numbers, and it is built to be read with that in mind. Every number',
  'below is **read from a committed artifact** and carries the path it came from.',
  'Nothing is typed in. Where a source cannot answer, §7 says so instead of',
  'estimating. And the denominator comes **first** — §2, before any mean — because',
  'a fidelity average over a hand-picked slice, printed without the slice, is the',
  'single most misleading thing this repo could publish. The companion document',
  'is not optional reading: [23 — Known Limitations](23-known-limitations.md) is',
  'the complete inventory of what this does not do, and it is longer than this one.',
);

if (CHECKS_FAILED.length > 0) {
  P(`> **⚠ ${fmt(CHECKS_FAILED.length)} CROSS-CHECK(S) DISAGREE.** Two artifacts that should report the same number do not. The disagreements are listed in [§8](#8-cross-checks--two-artifacts-that-must-agree) and are **not** resolved in this document's favour. Treat every figure below as suspect until they are reconciled.`);
}

P('---');

/* ---- 1. the summary ----------------------------------------------------- */
P('## 1. The one-paragraph version');
P(
  `Six third-party component libraries — ${LIBRARIES.map((l) => l.label).sort().join(', ')} — across five styling`,
  `architectures were run through one pipeline. ${fmt(REAL_N)} components came out with a measured floor:`,
  `**${f1(REAL_MEAN)}% mean computed-style equality** against the original npm package rendering in the same pinned`,
  `Chromium, exact string comparison with no tolerance, over ${fmt(REAL_CELLS)} compared style cells`,
  `(${fmt(REAL_GE90)} of ${fmt(REAL_N)} components at ≥90%, ${fmt(REAL_GE80)} of ${fmt(REAL_N)} at ≥80%).`,
  `In the other direction, a ${fmt(fid.length)}-variant Figma kit converted to code scores`,
  `**${f2(FID_MEAN)}% visual fidelity** over the ${fmt(fidScored.length)} statically scorable variants, and the`,
  `canvas→code→canvas executes through the fact diff on **${fmt(RT.roundTripClosed)} of ${fmt(RT.components)}** components with every`,
  `one of ${fmt(RT_FACTS)} facts classified as matched, diverged, lost or invented rather than dropped in silence.`,
  `Exact structured projection is separately evidenced: **${fmt(RT.exactVerified ?? 0)} verified exact, ${fmt(RT.exactLegacyUnverified ?? 0)} legacy unverified, ${fmt(RT.exactRefused ?? 0)} refused**.`,
  `The whole thing is pinned by ${fmt(evals.total)} executable claim gates and a ${fmt(GOLDEN_FILES)}-file byte-identical`,
  `generation manifest. **What that does not say:** those ${fmt(REAL_N)} components are`,
  `${COV_TOTAL ? f1(pct(COV_TOTAL.pinned, COV_TOTAL.size)) : '?'}% of the ${LIBRARIES.length} libraries they came from, and they were picked because they were the tractable ones.`,
);
P('---');

/* ---- 2. the denominator ------------------------------------------------- */
P('## 2. The denominator, first');
P(
  'Every mean in this document is an average over captured components. This is',
  'which components, and what fraction of each library they are. It is printed',
  'before the results, not after them, and repeated under each table that',
  'averages.',
);
if (covRows && COV_TOTAL) {
  P(...table(
    ['library', 'contracts committed', 'measured AND committed', 'library size', '**coverage**', 'source of the size'],
    LIBRARIES.map((l) => {
      const cov = coverage.get(l.dir);
      const measured = coveredCards.filter((s) => s.corpus === l.dir).length;
      return [
        `${l.label} (\`${l.pkg}\`)`,
        fmt(libContracts[l.dir]),
        fmt(measured),
        cov ? fmt(cov.size) : '**source cannot answer**',
        cov ? `**${f1(pct(measured, cov.size))}%**` : '—',
        cov ? '`docs/22-generality.md` §8.3' : 'no row in §8.3 matched this package id',
      ];
    }).concat([[
      '**total**', `**${fmt(FOREIGN_CONTRACTS)}**`, `**${fmt(COVERED_N)}**`, `**${fmt(COV_TOTAL.size)}**`,
      `**${f1(pct(COVERED_N, COV_TOTAL.size))}%**`, '',
    ]]),
  ));
  P(COVERAGE_CAVEAT);
  P(
    `**This table's coverage column is stricter than the one in docs/22 and docs/23, on purpose.**`,
    `Those two print ${fmt(COV_TOTAL.contracts)}/${fmt(COV_TOTAL.size)} = **${f1(pct(COV_TOTAL.contracts, COV_TOTAL.size))}%** — *contracts committed* over library size.`,
    `This page prints ${fmt(COVERED_N)}/${fmt(COV_TOTAL.size)} = **${f1(pct(COVERED_N, COV_TOTAL.size))}%** — components that are *both* measured`,
    `*and* backed by a committed contract, over library size, because this is the`,
    `document quoting the fidelity numbers and a component only counts as covered`,
    `when it was measured AND kept. A contract existing is not the same as a contract`,
    `being measured, and a scorecard existing is not the same as a stem shipping;`,
    `where these differ this page uses the smallest number.`,
    ...(HELD_CARDS.length
      ? [
        ``,
        `**${fmt(HELD_CARDS.length)} measured component(s) are deliberately excluded here**`,
        `because they carry a scorecard but no committed contract — captured with full`,
        `receipts and then HELD: ${HELD_CARDS.map((h) => `\`${h}\``).join(', ')}.`,
        `Counting them would report refused stems as shipped ones`,
        `(\`FC-COVERAGE-COUNTS-CAPTURES\`); their fidelity numbers still appear in §3,`,
        `which averages over everything measured.`,
      ]
      : []),
  );
  P(
    '**The size denominators lean against us on purpose** and are the one set of',
    'numbers here that is not machine-derived: they were produced by one-off',
    'extractor runs and recorded in prose in',
    '[docs/22 §8.3](22-generality.md#83-the-coverage-fraction--how-much-of-each-library-is-actually-captured),',
    'which this build parses rather than retypes. MUI\'s counts every capitalised',
    'directory including utilities; Carbon\'s, Polaris\'s and Astryx\'s are whatever',
    'this repo\'s own extractor could see, helpers included. The true denominators',
    'are smaller and the true percentages a little higher. The order of magnitude',
    'is the finding.',
  );
} else {
  P('**The coverage table in `docs/22-generality.md` §8.3 did not parse.** No coverage fraction is printed. Every mean below is therefore an average over an *unstated* slice, which is exactly the failure this section exists to prevent — fix the parse before trusting anything under §3.');
}
P(`Beyond the ${LIBRARIES.length} foreign libraries, the corpus also holds contracts that are **not** captured from a third party and are not counted above:`);
P(...table(['corpus', 'contracts', 'what it is', 'source'], [
  ['this repo\'s own library', fmt(OWN_CONTRACTS), 'hand-authored here; the code→design direction\'s fixture', '`contracts/*.contract.json`'],
  ['Untitled UI (Figma kit)', fmt(UUI_CONTRACTS), 'proposed FROM a canvas, not extracted from code — see §4', '`examples/untitled-ui/storybook/contracts/`'],
  ['Eventz (Figma kit)', fmt(EVENTZ_CONTRACTS), 'a designer\'s own file with real variable names', '`examples/eventz-vars/contracts/`'],
]));
P('---');

/* ---- 3. fidelity -------------------------------------------------------- */
P('## 3. Fidelity — code → contract → rendering');
P(
  'The measurement: an enriched contract is emitted to HTML by `core/emit-html`',
  'and compared against **the original npm package rendering** in the same pinned',
  'Chromium, per combination × interaction state. Computed-style equality is an',
  '**exact string match over the styled channel set, with no tolerance and no',
  'whitelist** — the browser\'s full longhand set is enumerated. A channel the',
  'pipeline never opened still counts against it.',
);
P(...table(
  ['library', 'components', 'mean %equal', 'median', '≥90%', '≥80%', 'cells compared', 'cell-weighted', 'source'],
  LIBRARIES.map((l) => {
    const rows = realCards.filter((s) => s.corpus === l.dir);
    if (!rows.length) return [l.label, '0', '—', '—', '—', '—', '—', '—', `\`extract/computed/out/${l.dir}/\` (none)`];
    const ps = rows.map(pctOf);
    const cc = rows.reduce((a, s) => a + s.v.computed.cellsCompared, 0);
    const ce = rows.reduce((a, s) => a + s.v.computed.cellsEqual, 0);
    return [
      l.label, fmt(rows.length), `**${f1(mean(ps))}**`, f1(median(ps)),
      `${ps.filter((x) => x >= 90).length}/${rows.length}`, `${ps.filter((x) => x >= 80).length}/${rows.length}`,
      fmt(cc), f1(pct(ce, cc)),
      `\`extract/computed/out/${rows[0].flat ? '<comp>' : `${l.dir}/<comp>`}/scorecard.json\``,
    ];
  }).concat([[
    '**all libraries**', `**${fmt(REAL_N)}**`, `**${f1(REAL_MEAN)}**`, f1(REAL_MEDIAN),
    `**${REAL_GE90}/${REAL_N}**`, `**${REAL_GE80}/${REAL_N}**`, `**${fmt(REAL_CELLS)}**`, `**${f1(REAL_WEIGHTED)}**`, '',
  ]]),
));
P(COVERAGE_CAVEAT);
P(
  `**Two means, both printed, because they answer different questions.** The`,
  `unweighted mean (${f1(REAL_MEAN)}%) treats a 16-cell Spinner and an 83,520-cell Button as equals;`,
  `the cell-weighted figure (${f1(REAL_WEIGHTED)}%) is what fraction of every style cell in the corpus`,
  `actually matched. Neither is quoted alone. Whole-row exactness is the harshest`,
  `cut of the same data: **${fmt(REAL_ROWS_EQ)} of ${fmt(REAL_ROWS)}** rendered rows`,
  `(${f1(pct(REAL_ROWS_EQ, REAL_ROWS))}%) match the original on *every* channel at once.`,
);

/* per component */
P('### 3.1 Every measured component, worst first');
P('No component is omitted. The worst row in the corpus is at the top.');
P(...table(['component', 'library', '%equal', 'combos × states', 'cells', 'source'],
  realCards.slice().sort((a, b) => pctOf(a) - pctOf(b) || a.rel.localeCompare(b.rel)).map((s) => [
    `\`${s.v.component ?? s.component}\``,
    (LIBRARIES.find((l) => l.dir === s.corpus) ?? { label: s.corpus }).label,
    f1(pctOf(s)),
    `${fmt(s.v.combos)} × ${fmt(s.v.interactions)}`,
    fmt(s.v.computed.cellsCompared),
    `\`${s.rel}\``,
  ]),
));

/* conformance */
P('### 3.2 The frontier fixture — held out of every average above');
P(
  `\`extract/computed/out/conformance/\` holds **${fmt(CONF_N)}** more scorecards with a mean of`,
  `**${f1(CONF_MEAN)}%** over ${fmt(CONF_CELLS)} cells. They are **excluded from §3 entirely** and`,
  'must never be folded into a library mean: they are *synthetic single-construct',
  'cases* built by this repo to probe one CSS or DOM feature each, not components',
  'from anyone\'s design system. Including them would raise the headline number by',
  'averaging in a fixture we wrote ourselves to be measurable. That is the shape',
  'of every overclaim this repo has caught, so the split is structural here — the',
  `corpus is partitioned by directory before any mean is taken, and §8 checks that`,
  'no scorecard escaped classification.',
);
P(...table(['fixture', 'cases', 'mean %equal', 'counted in §3?', 'source'], [
  [`synthetic CSS/DOM constructs`, fmt(CONF_N), f1(CONF_MEAN), '**no**', '`extract/computed/out/conformance/*/scorecard.json`'],
  [`real third-party components`, fmt(REAL_N), f1(REAL_MEAN), 'yes', '`extract/computed/out/**/scorecard.json`'],
]));
P('---');

/* ---- 4. the other direction --------------------------------------------- */
P('## 4. Fidelity — canvas → code');
P(
  'The reverse journey, measured on a real Figma community kit (Untitled UI).',
  'Variants are proposed from the canvas into contracts, emitted as static HTML,',
  'rendered, and scored against the exported reference image of the same variant.',
);
P(...table(['measure', 'value', 'source'], [
  ['rows in the scored table', fmt(fid.length), '`examples/untitled-ui/renders/fidelity.json`'],
  ['statically scorable', fmt(fidScored.length), 'same file, rows with a numeric `score`'],
  ['**mean fidelity over those**', `**${f2(FID_MEAN)}%**`, 'same file'],
  ['component sets', fmt(fidSets.length), 'same file, distinct `set`'],
  ['unscored', fmt(fidNull.length), 'same file, rows with `score: null` — itemised below'],
]));
P(
  `**The ${fmt(fidNull.length)} unscored rows are named, not dropped**, and they are not all one thing:`,
);
P(...table(['why a row is unscored', 'rows', 'source'],
  fidNullReasons.map(([note, n]) => [cell(note), fmt(n), '`fidelity.json`, `note` field']),
));
P(
  `Only ${fmt(fidNullReasons.find(([n]) => /interaction-state/.test(n))?.[1] ?? 0)} of them are the interaction-state exclusion`,
  '(a hover or focus rendering is produced by CSS at runtime and a static export',
  'cannot be scored against it). The rest are a **carriage gap, not an instrument',
  'limit** — an axis the pipeline did not carry — and they are counted here as',
  'such rather than folded into the same excuse.',
);
P('### 4.1 Per component set');
P(...table(['set', 'variants scored', 'mean fidelity', 'source'],
  fidSets.map((s) => [`\`${s.set}\``, fmt(s.n), f2(s.mean), '`examples/untitled-ui/renders/fidelity.json`']),
));
P(
  '**Denominator for this table:** these are the sets in one community kit that',
  'were imported at all. The kit\'s un-imported sets do not appear as low scores;',
  `they do not appear. See [23 §1](23-known-limitations.md#1-coverage--how-much-of-a-library-is-actually-captured).`,
);
P('---');

/* ---- 5. determinism ----------------------------------------------------- */
P('## 5. Reproducibility — the part that is not a percentage');
P(
  'A fidelity number you cannot reproduce is an anecdote. These are the pins that',
  'make the numbers above re-derivable, and each is enforced by a gate rather than',
  'asserted in prose.',
);
P(...table(['pin', 'value', 'what it forbids', 'source'], [
  ['generated source, byte-identical', `${fmt(GOLDEN_FILES)} files hashed`, 'a contract change altering generated code without review', '`evals/golden.json`'],
  ['capture double-sweep identity', `${fmt(detOk)}/${fmt(numbers.length)} runs`, 'a capture whose second sweep disagrees with its first', '`extract/computed/out/**/numbers.json`, `determinism`'],
  ['browser captures behind the corpus', fmt(CAPTURES), 'a floor quoted from a sample smaller than it claims', 'same files, `captures`'],
  ['executable claims', `${fmt(evals.total)} gates`, 'a documented behaviour with no test', '`evals/results.json`'],
  ['dropped-fact receipt count', `${fmt(DAGGER_TOTAL)} pinned exactly`, 'honesty being switched off unnoticed — see §6', '`extract/figma/dagger-census.json`'],
  ['doc numbers vs the repo', 'gated', 'a doc quoting a number the repo no longer produces', '`scripts/docs-numbers-check.mjs`'],
  ['this document vs its sources', '`--check`', 'this page going stale while still reading as current', '`scripts/build-capability-report.mjs`'],
]));
if (detOther.length) {
  P(`**${fmt(detOther.length)} capture run(s) do not carry the expected determinism phrase**, and are listed rather than rounded away:`);
  P(...detOther.map((s) => `- \`${cell(s)}\``));
}
P('### 5.1 The claim suite by class');
P(
  `The ${fmt(evals.total)} evals are not all "does it work". They are classified by what they`,
  'claim, and the largest classes after extraction are **detection** and',
  '**refusal** — gates that fail if the engine *stops* saying no. That balance is',
  'the point: an engine that carries everything is not a better engine, it is one',
  'that has stopped telling you what it could not do.',
);
P(...table(['claim class', 'gates', 'what the class asserts', 'source'],
  byClaim.map(([k, v]) => [
    `\`${k}\``, `${fmt(v.total)}`,
    ({
      'C1-determinism': 'same input, same bytes out',
      'C2-refusal': 'the engine refuses BY NAME rather than guessing',
      'C3-detection': 'a defect or drift is caught, not silently absorbed',
      'C4-convergence': 'a round trip settles instead of oscillating',
      'C5-extraction': 'a fact is carried out of a real library correctly',
      'C6-theming': 'a mode/brand switch resolves to the right values',
      'C7-cli': 'the command-line surface behaves as documented',
      'C8-journey': 'an end-to-end adopter path completes',
    })[k] ?? '(no description registered for this class)',
    '`evals/results.json`',
  ]),
));
P('---');

/* ---- 6. the honesty instruments ----------------------------------------- */
P('## 6. The honesty instruments, counted as features');
P(
  'These are the numbers this repo is least tempted to publish and most needs to.',
  'Each one counts something the engine **could not do and said so**. They belong',
  'in a capability report because a conversion tool without them is not more',
  'capable — it is just quieter.',
);

P('### 6.1 Dropped-fact receipts (`†`)');
P(
  `When the plugin engine compiles a contract and cannot carry a fact onto the`,
  `canvas, it emits a receipt naming the fact. Across ${fmt(daggerRows.length)} committed corpora there are`,
  `**${fmt(DAGGER_TOTAL)}** such receipts, and the count is pinned **exactly** — in both directions.`,
  `Fewer receipts is not automatically progress: it is either a real fix or a`,
  `refusal path that quietly stopped firing, and both require a human to look.`,
);
P(...table(['corpus', 'dropped-fact receipts', 'contracts carrying one', 'source'],
  daggerRows.map((r) => [`\`${r.corpus}\``, fmt(r.receipts), fmt(r.contracts), '`extract/figma/dagger-census.json`'])
    .concat([['**total**', `**${fmt(DAGGER_TOTAL)}**`, '', '']]),
));

P('### 6.2 Named refusals — the construct vocabularies');
P(
  'Two hand-authored manifests are the independent denominators for "what can the',
  'engine be asked to do". Both are deliberately **not** derived from the code that',
  'decides carriage — every instrument that derives its denominator from the same',
  'filter that decides carriage scores 100% on a channel it never opened.',
);
P(...table(['manifest', 'cases', 'breakdown', 'source'], [
  [
    'canvas constructs',
    fmt(canvasMan.cases.length),
    canvasByExpect.map(([k, v]) => `${k} ${v}`).join(' · '),
    '`extract/figma/conformance/MANIFEST.json`',
  ],
  [
    'CSS / DOM frontier',
    fmt(cssMan.count),
    cssByExpect.map(([k, v]) => `${k} ${v}`).join(' · '),
    '`conformance/MANIFEST.json`',
  ],
]));
P(
  `Of the ${fmt(canvasMan.cases.length)} canvas constructs, ${canvasByStatus.map(([k, v]) => `**${fmt(v)}** are \`${k}\``).join(', ')}.`,
  `A construct that is neither carried nor named-refused is a hard failure of that`,
  `suite — "it silently did nothing" is not an allowed outcome.`,
);

P('### 6.3 Every execution reaches the fact diff; exactness is separate');
P(
  'Canvas → code → canvas, on the Untitled UI kit. The claim is **not** that the',
  'round trip is lossless or exact. It runs to completion on',
  'every component and every fact lands in exactly one of four buckets, so a loss',
  'is a row in a table rather than an absence.',
);
P(...table(['bucket', 'facts', 'share of all facts', 'source'], [
  ['matched', fmt(RT.matched), `${f1(pct(RT.matched, RT_FACTS))}%`, '`extract/figma/roundtrip-uui/report.json`'],
  ['diverged', fmt(RT.diverged), `${f1(pct(RT.diverged, RT_FACTS))}%`, 'same file'],
  ['loss', fmt(RT.loss), `${f1(pct(RT.loss, RT_FACTS))}%`, 'same file'],
  ['invented', fmt(RT.invented), `${f1(pct(RT.invented, RT_FACTS))}%`, 'same file'],
  ['**components executed to fact diff**', `**${fmt(RT.roundTripClosed)} / ${fmt(RT.components)}**`, '', 'same file, `totals`'],
  ['**verified exact projections**', `**${fmt(RT.exactVerified ?? 0)} / ${fmt(RT.components)}**`, '', 'same file, `totals.exactVerified`'],
  ['legacy-unverified projections', fmt(RT.exactLegacyUnverified ?? 0), '', 'same file, `totals.exactLegacyUnverified`'],
]));
P(
  `**${f1(pct(RT.matched, RT_FACTS))}% matched is the honest headline, and it is not high.** The value of this`,
  'instrument is the classification, not the ratio — and the largest single',
  'category is an artifact of the comparison rather than a loss:',
);
P(
  `- **\`auto-layout-inert\` — ${fmt(AL_INERT)} of the ${fmt(LAYOUT_MODE_DIVERGED)} \`layout.mode\` divergences**`,
  `  (${f1(pct(AL_INERT, RT.diverged))}% of all divergence). A frame with one child, or with children the`,
  '  designer positioned absolutely, has no observable auto-layout direction to',
  '  read back; the engine writes a direction that the original canvas did not',
  '  record. It is tagged as its own class precisely so it cannot be counted as a',
  `  fidelity loss. The remaining ${fmt(LAYOUT_MODE_DIVERGED - AL_INERT)} \`layout.mode\` divergences are real.`,
);
P('Every bucket is tagged, and the untagged remainder is reported as untagged:');
P(...table(['bucket', 'tag', 'facts', 'source'],
  [['diverged', divTags], ['loss', lossTags], ['invented', invTags]].flatMap(([bucket, tags]) =>
    tags.map(([t, n]) => [bucket, `\`${t}\``, fmt(n), '`extract/figma/roundtrip-uui/report.json`'])),
));
P(
  `The \`(untagged)\` rows are the honest hole in this instrument: those facts are`,
  'classified into a bucket but carry no *reason*, so nothing here can say whether',
  'they are engine defects or comparison artifacts. They are printed rather than',
  'excluded from the denominator.',
);
P('---');

/* ---- 7. what a source cannot answer ------------------------------------- */
P('## 7. What the sources cannot answer');
P(
  'Questions a reader of this page will reasonably ask, for which no committed',
  'artifact holds an answer. They are listed instead of estimated, and instead of',
  'quietly omitted — an omission reads as "nothing to report here", which is a',
  'stronger claim than the evidence supports.',
);
P(...table(['question', 'why this document does not answer it'],
  notAnswered.slice().sort((a, b) => a.question.localeCompare(b.question)).map((q) => [cell(q.question), cell(q.why)]),
));
P(
  '**Also not measured anywhere, and therefore not claimed:** how long a library',
  'takes to onboard, how much of the work is expert-configured rather than',
  'automatic, and whether any of this holds past the coverage fraction in §2.',
  'Those are the questions [23 — Known Limitations](23-known-limitations.md)',
  'exists to answer, and it answers them against this tool.',
);
P('---');

/* ---- 8. cross-checks ---------------------------------------------------- */
P('## 8. Cross-checks — two artifacts that must agree');
P(
  'Every row is a number this build derived twice, from independent files. A',
  'disagreement is printed here and is never resolved toward the more flattering',
  'value. This section is the reason to trust §3 more than a hand-written table:',
  'the corpus is counted by the filesystem and again by a document written months',
  'earlier for a different purpose.',
);
P(...table(['what must agree', 'derived here', 'and here', 'result'],
  checks.map((c) => [
    cell(c.question),
    `${cell(c.a)} — \`${cell(c.aSrc)}\``,
    `${cell(c.b)} — \`${cell(c.bSrc)}\``,
    c.agree ? '✔' : '**✘ DISAGREE**',
  ]),
));
P(
  CHECKS_FAILED.length === 0
    ? `All ${fmt(checks.length)} agree.`
    : `**${fmt(CHECKS_FAILED.length)} of ${fmt(checks.length)} disagree.** Reconcile the artifacts, not this document.`,
);
P('---');

/* ---- 9. reproduce ------------------------------------------------------- */
P('## 9. How to reproduce every number on this page');
P('```bash\n' +
  `# rebuild this document from the committed artifacts (no browser, no network,\n` +
  `# no capture run — it only reads files that are already in the repo)\n` +
  `${BUILD_CMD}\n\n` +
  `# refuse if the committed copy differs from a rebuild (this is also an eval)\n` +
  `npm run capability:fresh\n` +
  '```');
P('### Sources this build read');
P(...table(['artifact', 'sha256 (12)', 'bytes', 'what it supplied'],
  sources.slice().sort((a, b) => a.rel.localeCompare(b.rel) || a.label.localeCompare(b.label))
    .map((s) => [`\`${s.rel}\``, `\`${s.hash}\``, fmt(s.bytes), cell(s.label)]),
));
P(
  'Same bytes in, same file out: this build reads no clock, no git state and no',
  'environment, and sorts every collection before rendering.',
);
P('---');

/* ---- 10. the cost ------------------------------------------------------- */
P('## 10. What it costs');
P(
  'Not restated here, deliberately — a summary of the limitations written by the',
  'success document is a summary written by the interested party. The complete',
  'inventory is **[23 — Known Limitations](23-known-limitations.md)**, and it is',
  'the longer document. Start with its §1, which holds the same coverage',
  'denominator this page opens with.',
);
P(
  'Further reading: [22 — Generality](22-generality.md) (the evidence behind the',
  'engine claim and where it leaks) ·',
  '[conformance/EXPECTATIONS.md](../conformance/EXPECTATIONS.md) (the measured CSS/DOM frontier) ·',
  '[18 — User Flows](18-user-flows.md) (the ranked gap list).',
);

/* ==================================================================== EMIT */

const rendered = `${L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;

// FRESHNESS. `--check` re-derives the document and REFUSES if the committed
// bytes differ, instead of writing. This matters more here than for any other
// aggregator in the repo: a STALE success document is a document making
// favourable claims the repo can no longer support, and it is the one artifact
// an adopter is most likely to read and least likely to re-derive.
if (process.argv.includes('--check')) {
  const committed = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (committed !== rendered) {
    console.error(
      `STALE: ${OUT_NAME} does not match a rebuild from its committed sources.\n` +
        'Every number in it is READ from an artifact; one of those artifacts moved.\n' +
        `Rebuild it and commit:  ${BUILD_CMD}`,
    );
    process.exit(1);
  }
  console.log(`✔ ${OUT_NAME} is byte-identical to a rebuild from its committed sources.`);
  process.exit(0);
}

writeFileSync(OUT, rendered, 'utf8');
console.log(
  `${OUT_NAME} — ${fmt(REAL_N)} measured components over ${fmt(LIBRARIES.length)} libraries ` +
    `(mean ${f1(REAL_MEAN)}%, cell-weighted ${f1(REAL_WEIGHTED)}%, coverage ${COV_TOTAL ? f1(pct(COVERED_N, COV_TOTAL.size)) : '?'}%), ` +
    `${fmt(fidScored.length)} scored canvas variants (${f2(FID_MEAN)}%), ` +
    `${fmt(evals.passed)}/${fmt(evals.total)} evals, ${fmt(DAGGER_TOTAL)} dropped-fact receipts, ` +
    `${fmt(checks.length)} cross-checks (${CHECKS_FAILED.length} disagreeing), ` +
    `${fmt(notAnswered.length)} question(s) the sources cannot answer`,
);
