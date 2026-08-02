/**
 * THE INTAKE — `npm run gauntlet:intake`
 *
 * The question this answers is not "what does the kit score". It is: **does a
 * NEW design system still teach us something we did not already know?**
 *
 * Every round so far has been driven by one system at a time, and every one
 * has produced new refusal classes — Eventz alone, a SEVEN-set kit, produced
 * five (the hover plane, text styles as vocabulary, U+2024 variable names, a
 * silent Dark-is-Light mode bug, and both paste-door blockers). While that
 * keeps happening the tool is not finished, however good any single score
 * looks. The finish line is CONVERGENCE: new systems stop introducing new
 * classes. This file measures that, and nothing else.
 *
 * It is deliberately NOT a scorer. The engine is deterministic — there is no
 * model here to train — so a new system cannot make it "better" by being fed
 * in. What a new system can do is EXPOSE a construct the vocabulary cannot
 * carry, and that is a discrete, countable thing: a refusal class. The
 * per-system census (census.ts) already ranks those; the intake runs it over
 * N systems and asks, in order, which classes each system introduced that no
 * earlier one had.
 *
 * SIZE IS A DIMENSION, not a footnote. A 7-set kit and a 1,618-set kit fail
 * differently, so each system declares a tier and the report groups by it —
 * a class that only ever appears at L/XL is a scale finding, and one that
 * appears at S is a vocabulary finding.
 *
 *   npm run gauntlet:intake            # verify (refuses on drift)
 *   npm run gauntlet:intake -- --write # rewrite GAUNTLET.md + intake.json
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'extract', 'figma', 'gauntlet');
const WRITE = process.argv.includes('--write');

/** Size tiers, by COMPONENT SET count — the unit a designer thinks in. */
type Tier = 'S' | 'M' | 'L' | 'XL';
const tierOf = (sets: number): Tier => (sets <= 10 ? 'S' : sets <= 50 ? 'M' : sets <= 200 ? 'L' : 'XL');

interface System {
  id: string;
  /** What it is, and why it is in the intake (never "another kit"). */
  what: string;
  dump: string;
  /** Third-party systems are the ones that test GENERALITY; ours test depth. */
  origin: 'third-party' | 'ours';
}

/** THE REGISTRY. Adding a row here is how a system enters the intake — the
 *  point is that this list grows and the NEW-CLASS column trends to zero. */
const SYSTEMS: System[] = [
  {
    id: 'cbds',
    what: "the owner's kit — the breadth case: 1,618 sets, 95% single-variant icons, real composites",
    dump: 'extract/figma/fixtures/cbds-plugin-all-sets.v14.dump.json',
    origin: 'ours',
  },
  {
    id: 'untitled-ui',
    what: 'a real Figma Community kit — the only PIXEL-VERIFIED system (537 variants scored), publishes ZERO variables',
    dump: 'examples/untitled-ui/dumps-v2/MERGED.dump.json',
    origin: 'third-party',
  },
  {
    id: 'eventz',
    what: 'a variables-based system — 376 variables, 3 collections, Light/Dark; the real-token-name path',
    dump: 'examples/eventz-vars/dumps/MERGED.json',
    origin: 'ours',
  },
];

interface CensusSummary {
  sets: number;
  clean: number;
  notClean: number;
  skipped: number;
  notesTotal?: number;
  unboundTotal?: number;
  degradationsTotal?: number;
}
interface CensusFile {
  summary: CensusSummary;
  /** census.ts spells the class key `cls`. Reading `class`/`name` here made
   *  EVERY system report zero classes and the report announce convergence on
   *  its first run — a false zero is the most dangerous possible value for
   *  this metric, because it says "stop working". Hence the cross-check
   *  below: a system with unclean sets and no classes is a BUG in the intake,
   *  not evidence about the system. */
  classes: Array<{ cls?: string; class?: string; name?: string; sets?: number; count?: number }>;
  sets?: Array<{ clean?: boolean; violationClasses?: string[]; noteClasses?: string[] }>;
}

const results: Array<{
  sys: System;
  tier: Tier;
  summary: CensusSummary;
  classes: string[];
  newClasses: string[];
  noteClasses: string[];
  newNotes: string[];
}> = [];

const seen = new Set<string>();
const seenNotes = new Set<string>();

for (const sys of SYSTEMS) {
  if (!existsSync(path.join(ROOT, sys.dump))) {
    console.error(`INTAKE REFUSED: ${sys.id}'s dump is missing (${sys.dump}). A registry row without its dump would silently drop a system from the convergence count.`);
    process.exit(1);
  }
  const tmp = mkdtempSync(path.join(tmpdir(), `intake-${sys.id}-`));
  execFileSync('npx', ['tsx', 'extract/figma/gauntlet/census.ts', sys.dump, '--out', tmp], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  const census = JSON.parse(readFileSync(path.join(tmp, 'census.json'), 'utf8')) as CensusFile;
  const classes = (census.classes ?? [])
    .map((c) => c.cls ?? c.class ?? c.name ?? '')
    .filter((c) => c.length > 0)
    .sort();
  // THE FALSE-ZERO GUARD. If a system has sets that are not clean, it MUST
  // have produced classes; zero means this file failed to read them, and a
  // convergence report that under-reports says "the work is done" when it is
  // not. Refuse rather than publish it.
  if (census.summary.notClean > 0 && classes.length === 0) {
    console.error(
      `INTAKE REFUSED: ${sys.id} reports ${census.summary.notClean} unclean set(s) but ZERO refusal classes. ` +
        'That combination is impossible from the census and means the class field was not read — publishing it ' +
        'would announce convergence that has not happened. Fix the census.json class mapping in intake.ts.',
    );
    process.exit(1);
  }
  // The NOTE classes — facts the proposal READ and did not carry. A set can be
  // "clean" (every surface emitted) while dropping a whole plane, so counting
  // refusals alone would call Eventz converged on the very round it lost its
  // hover states. These are the classes the rounds actually chased.
  const noteClasses = [...new Set((census.sets ?? []).flatMap((r) => r.noteClasses ?? []))].sort();
  const newNotes = noteClasses.filter((c) => !seenNotes.has(c));
  for (const c of noteClasses) seenNotes.add(c);
  const newClasses = classes.filter((c) => !seen.has(c));
  for (const c of classes) seen.add(c);
  results.push({ sys, tier: tierOf(census.summary.sets), summary: census.summary, classes, newClasses, noteClasses, newNotes });
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

const pct = (n: number, d: number) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`);
const md: string[] = [
  '# THE INTAKE — does a new design system still teach us anything?',
  '',
  'Generated by `npm run gauntlet:intake -- --write`. Byte-verified against a rebuild.',
  '',
  'This is **not** a scorer. The engine is deterministic — there is no model here to',
  'train — so feeding it a system cannot make it better. What a new system can do is',
  'EXPOSE a construct the vocabulary cannot carry, and that is a discrete, countable',
  'thing: a refusal class. The finish line is **convergence** — new systems stop',
  'introducing new classes. Until then, "done" is not available at any score.',
  '',
  '## Convergence',
  '',
  '| # | system | origin | tier | sets | clean | NEW refusals | NEW carriage gaps | total classes |',
  '|---|---|---|---|---:|---:|---:|---:|---:|',
  ...results.map((r, i) =>
    `| ${i + 1} | ${r.sys.id} | ${r.sys.origin} | ${r.tier} | ${r.summary.sets} | ${pct(r.summary.clean, r.summary.sets)} | **${r.newClasses.length}** | **${r.newNotes.length}** | ${r.classes.length + r.noteClasses.length} |`,
  ),
  '',
  `**${seen.size} distinct refusal class(es) and ${seenNotes.size} distinct CARRIAGE-GAP class(es)`,
  `across ${results.length} system(s).** Both NEW columns must reach zero.`,
  '',
  'A REFUSAL is loud — a surface declined to emit. A CARRIAGE GAP is quiet: every',
  'surface emitted and the proposal dropped a fact it had already read, naming it in a',
  'note. `clean` only sees the first kind, which is why Eventz reads 100% clean on the',
  'same round it lost its entire hover plane. The second column is the one that has',
  'driven every round of this campaign.',
  '',
  '## What this metric can and cannot do yet',
  '',
  'The REFUSAL column is trustworthy: refusal classes are already normalised by the',
  'census and the counts are small and nameable. On its first run it caught a real one',
  "— Untitled UI's Avatar overrides a child's `size` that the child never declares",
  'overridable, so all four surfaces refuse that set.',
  '',
  '**The CARRIAGE-GAP column is not a taxonomy yet, and should not be read as one.**',
  'It is normalised to the rule clause of each note, which took the distinct count from',
  '1,703 to the numbers above — real progress, and still far too many to trend to zero.',
  'Eventz at 46 is close to nameable; CBDS at 705 is dominated by per-icon variation',
  'across 1,542 single-variant components and is measuring kit size as much as',
  'vocabulary. The column is committed anyway because the DIMENSION is the point: a',
  'convergence metric that counted only refusals would have called Eventz converged on',
  'the same round it silently lost its hover plane. Sharpening the normaliser until',
  'these counts are nameable classes is the next piece of work, and until then the',
  'honest reading of the second column is "this many distinct note shapes", not "this',
  'many vocabulary gaps".',
  '',
  '## Size coverage',
  '',
  '| tier | sets | systems | third-party |',
  '|---|---|---|---|',
  ...(['S', 'M', 'L', 'XL'] as Tier[]).map((t) => {
    const inTier = results.filter((r) => r.tier === t);
    const range = { S: '≤10', M: '11–50', L: '51–200', XL: '200+' }[t];
    const third = inTier.filter((r) => r.sys.origin === 'third-party').length;
    return `| **${t}** | ${range} | ${inTier.length > 0 ? inTier.map((r) => r.sys.id).join(', ') : '— none —'} | ${third} |`;
  }),
  '',
  'A tier with no third-party system is a GENERALITY hole: it proves the engine handles',
  'a system of that size that we built, and nothing more. A tier with no system at all is',
  'simply unmeasured — the honest word for it is not "passing".',
  '',
  '## What each system is here to test',
  '',
  ...results.flatMap((r) => [
    `- **${r.sys.id}** (${r.tier}, ${r.summary.sets} sets) — ${r.sys.what}.`,
    ...(r.newClasses.length > 0
      ? [`  - ${r.newClasses.length} NEW refusal class(es): ${r.newClasses.map((c) => `\`${c}\``).join(', ')}`]
      : ['  - no new refusal classes.']),
    ...(r.newNotes.length > 0
      ? [`  - ${r.newNotes.length} NEW carriage-gap class(es), e.g. ${r.newNotes.slice(0, 5).map((c) => `\`${c}\``).join('; ')}`]
      : ['  - no new carriage gaps.']),
  ]),
  '',
];

const text = `${md.join('\n')}`;
const jsonOut = `${JSON.stringify(
  {
    _note: 'Convergence intake — NEW refusal classes per system, in intake order. Regenerate: npm run gauntlet:intake -- --write',
    systems: results.map((r) => ({
      id: r.sys.id,
      origin: r.sys.origin,
      tier: r.tier,
      sets: r.summary.sets,
      clean: r.summary.clean,
      classes: r.classes,
      newClasses: r.newClasses,
      noteClasses: r.noteClasses,
      newNotes: r.newNotes,
    })),
    distinctClasses: [...seen].sort(),
  },
  null,
  2,
)}\n`;

const files: Array<[string, string]> = [
  [path.join(OUT_DIR, 'GAUNTLET.md'), text],
  [path.join(OUT_DIR, 'intake.json'), jsonOut],
];
const drift = files.filter(([f, want]) => {
  let cur: string | null = null;
  try {
    cur = readFileSync(f, 'utf8');
  } catch {
    cur = null;
  }
  return cur !== want;
});

console.log(text);
if (WRITE) {
  for (const [f, want] of files) writeFileSync(f, want);
  console.log(drift.length === 0 ? '= unchanged' : `✎ rewrote ${drift.length} file(s)`);
} else if (drift.length > 0) {
  console.error(`✘ GAUNTLET.md / intake.json DIVERGE from a rebuild — run with --write`);
  process.exit(1);
} else {
  console.log('✔ byte-identical to a rebuild');
}
