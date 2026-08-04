/**
 * THE TOKEN-SNAPSHOT COMPARATOR — `npm run tokens:snapshot:check`.
 *
 * WHAT IT IS. The automatable half of the roadmap line "Live token
 * re-extraction … verified manually 264/264 on 2026-07-03; make it automatic".
 * It derives the variable table `tokens/` implies and diffs it against
 * `parity/snapshots/figma-tokens.json` — the artifact a HUMAN produced by
 * running `parity/extract-figma.plugin.js` inside the live Figma file — on
 * three axes: variable NAME, EVERY MODE VALUE, and ALIAS TARGET. No
 * credential, no network, milliseconds.
 *
 * WHY IT IS NOT `npm run parity`. The differ does this comparison too (see
 * parity/diff.ts § "figma-tokens"), but parity is EXCLUDED from every lane by
 * name (.github/scripts/lane-coverage.ts) for two reasons that have nothing to
 * do with the token half: it goes red on snapshot AGE, and it rewrites
 * parity/report.json on every run, dirtying the checkout. This gate writes
 * nothing, refuses only on real token drift, and PRINTS the age instead of
 * dying on it — so the token comparison can run on every push while the
 * component half waits for a human in Figma.
 *
 * ── THE TAUTOLOGY THIS GATE MUST NEVER BECOME ────────────────────────────────
 * A gate that compares `tokens/` against something derived from `tokens/`
 * proves exactly nothing. The whole value here is that the right-hand side was
 * EXTRACTED, not computed. So before comparing anything, this file REFUSES a
 * snapshot that cannot name where it came from: `fileKey` and `extractedAt`
 * are stamped by the plugin (parity/extract-figma.plugin.js:84-85) and exist
 * in no token file. Their absence is a hard exit, not a warning.
 *
 * Honest limit, stated because the refusal above does not close it: a stamp
 * proves the artifact was WRITTEN by the plugin, not that it was written
 * RECENTLY. What bounds the claim is the age line this gate always prints.
 * Measured at the time of writing: the snapshot carries
 * extractedAt=1783527446758 (2026-07-08) — 27.2 days old against a
 * MAX_SNAPSHOT_AGE_DAYS of 14. It is stale, it says so on every run, and
 * `--strict-age` turns that into an exit code for anyone who wants it.
 *
 * ── THE TWO NORMALIZATION RULES, AND WHY EACH ONE EARNS ITS PLACE ────────────
 * The two sides spell the same fact differently. Both rules were measured
 * against a CLEAN tree — with the rule removed, this gate reports phantom
 * drifts on a file where nothing has drifted:
 *
 *   RULE px-strip  — DTCG carries dimensions as unit-strings ('1px', '2px',
 *                    '12px', '640px', '999px'); the Figma FLOAT variable
 *                    carries the number (1, 2, 12, 640, 999). Compare
 *                    numerically. Removing it: 26 phantom drifts on a clean
 *                    tree (`--no-rule=px`).
 *   RULE alias     — DTCG spells a reference '{space.150}', dots between path
 *                    segments; Figma spells the same alias '{space/150}',
 *                    slashes. Removing it: 376 phantom drifts on a clean tree
 *                    — every one of the 376 alias mode-values there are
 *                    (`--no-rule=alias`).
 *
 * Hex case is folded on both sides for the same reason (DTCG authors mixed
 * case, the plugin emits upper) — it is not a measured drift source today, so
 * it is not counted as one of the two.
 *
 * ── FALSIFICATION, both directions ───────────────────────────────────────────
 *   REVERT the fix   → `--no-rule=px` / `--no-rule=alias` re-introduce exactly
 *                      the spelling gap each rule closes; the gate goes red
 *                      and names the phantoms.
 *   OVER-APPLY it    → `--snapshot=<copy>` with one token VALUE perturbed goes
 *                      red and names that token. A rule broad enough to
 *                      swallow a real value change would keep this green.
 * Both probes are run and quoted in docs/07-validation.md.
 *
 * USAGE
 *   npm run tokens:snapshot:check
 *   npm run tokens:snapshot:check -- --snapshot=/tmp/perturbed.json
 *   npm run tokens:snapshot:check -- --no-rule=px
 *   npm run tokens:snapshot:check -- --strict-age
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DEFAULT_SNAPSHOT = path.join('parity', 'snapshots', 'figma-tokens.json');
const MAX_SNAPSHOT_AGE_DAYS = Number(process.env.MAX_SNAPSHOT_AGE_DAYS ?? 14);

// ---------------------------------------------------------------------------
// Arguments — every one of them a falsification probe, none of them a way to
// make a red run green.
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const argOf = (flag: string) => {
  const hit = argv.find((a) => a === flag || a.startsWith(`${flag}=`));
  return hit === undefined ? undefined : hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : '';
};
const snapshotPath = argOf('--snapshot') || DEFAULT_SNAPSHOT;
const disabledRules = new Set(
  argv.filter((a) => a.startsWith('--no-rule=')).map((a) => a.slice('--no-rule='.length)),
);
const strictAge = argv.includes('--strict-age');
for (const r of disabledRules) {
  if (r !== 'px' && r !== 'alias') {
    console.error(`✖ --no-rule=${r} names no rule. Known rules: px, alias.`);
    process.exit(2);
  }
}
// A typo must never be a silent no-op: `--strictage` would otherwise run the
// ordinary check and exit 0, which reads as "the strict probe passed".
const KNOWN_FLAGS = ['--snapshot', '--no-rule', '--strict-age'];
const unknown = argv.filter((a) => !KNOWN_FLAGS.some((f) => a === f || a.startsWith(`${f}=`)));
if (unknown.length > 0) {
  console.error(`✖ unrecognized argument(s): ${unknown.join(' ')}. Known: ${KNOWN_FLAGS.join(', ')}.`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// The DERIVED side — the variable table tokens/ implies.
//
// The three collections and their modes mirror scripts/build-tokens.mjs and
// scripts/generate-figma.ts, which are what actually built the Figma file:
//   Primitives  1 mode  'Value'   ← tokens/primitives.tokens.json
//   Semantic    2 modes L/D       ← tokens/semantic.tokens.json (mode-invariant,
//                                   the same value under both modes)
//                                 + tokens/modes/semantic.{light,dark}.tokens.json
//   Brand       1 mode per        ← tokens/modes/brand.<name>.tokens.json,
//               brand file          discovered, mode name Capitalised, and
//                                   `default` FIRST — Figma's modes[0] is the
//                                   collection default, and the generator pins
//                                   that (core/emit-figma-script.ts:444-445).
//                                   Deriving the order from the filenames
//                                   instead reports [Aurora, Default] against
//                                   the snapshot's [Default, Aurora] as drift
//                                   on a clean tree — measured while building
//                                   this gate, and the reason mode ORDER is an
//                                   axis here rather than mode SET.
// ---------------------------------------------------------------------------
type Flat = Map<string, unknown>;

function flatten(tree: Record<string, unknown>, prefix: string[] = [], out: Flat = new Map()): Flat {
  for (const [key, value] of Object.entries(tree)) {
    if (key.startsWith('$')) continue;
    if (value && typeof value === 'object') {
      if ('$value' in (value as object)) out.set([...prefix, key].join('/'), (value as { $value: unknown }).$value);
      else flatten(value as Record<string, unknown>, [...prefix, key], out);
    }
  }
  return out;
}
const readTokens = (rel: string): Flat => flatten(JSON.parse(readFileSync(path.join(ROOT, rel), 'utf8')));

interface ExpectedCollection {
  name: string;
  modes: string[];
  variables: Map<string, Record<string, unknown>>; // variable name → mode → value
}

function deriveExpected(): ExpectedCollection[] {
  const primitives = readTokens('tokens/primitives.tokens.json');
  const semantic = readTokens('tokens/semantic.tokens.json');
  const light = readTokens('tokens/modes/semantic.light.tokens.json');
  const dark = readTokens('tokens/modes/semantic.dark.tokens.json');

  const brandNames = readdirSync(path.join(ROOT, 'tokens', 'modes'))
    .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
    .map((f) => f.replace(/^brand\.|\.tokens\.json$/g, ''))
    // `default` first, then alphabetical — byte-for-byte the generator's rule
    // (core/emit-figma-script.ts:444-445), because modes[0] is the collection
    // default in Figma and the order is therefore a fact, not a listing.
    .sort((a, b) => (a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b)));
  const brandModes = brandNames.map((n) => ({
    mode: n.replace(/^./, (c) => c.toUpperCase()),
    tokens: readTokens(`tokens/modes/brand.${n}.tokens.json`),
  }));

  const out: ExpectedCollection[] = [
    {
      name: 'Primitives',
      modes: ['Value'],
      variables: new Map([...primitives].map(([p, v]) => [p, { Value: v }])),
    },
  ];

  if (brandModes.length > 0) {
    // Every brand mode declares the same key set; a key present in one brand
    // file and absent from another surfaces below as an undefined mode value,
    // which is a drift, not a silent skip.
    const keys = new Set<string>();
    for (const b of brandModes) for (const k of b.tokens.keys()) keys.add(k);
    out.push({
      name: 'Brand',
      modes: brandModes.map((b) => b.mode),
      variables: new Map(
        [...keys].map((k) => [k, Object.fromEntries(brandModes.map((b) => [b.mode, b.tokens.get(k)]))]),
      ),
    });
  }

  const semanticVars = new Map<string, Record<string, unknown>>();
  for (const [p, v] of semantic) semanticVars.set(p, { Light: v, Dark: v });
  for (const [p, v] of light) semanticVars.set(p, { Light: v, Dark: dark.get(p) });
  for (const [p, v] of dark) if (!semanticVars.has(p)) semanticVars.set(p, { Light: light.get(p), Dark: v });
  out.push({ name: 'Semantic', modes: ['Light', 'Dark'], variables: semanticVars });

  return out;
}

// ---------------------------------------------------------------------------
// Normalization — the two measured rules.
// ---------------------------------------------------------------------------
const ALIAS_RE = /^\{([^}]+)\}$/;

function normalize(v: unknown): string {
  if (v === undefined) return '<absent>';
  if (typeof v === 'string') {
    const alias = v.match(ALIAS_RE);
    if (alias) {
      // RULE alias: DTCG '{a.b.c}' ⟷ Figma '{a/b/c}'.
      return disabledRules.has('alias') ? v : `{${alias[1].split('.').join('/')}}`;
    }
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return v.toUpperCase();
    // RULE px: DTCG '12px' ⟷ Figma FLOAT 12.
    const px = v.match(/^(-?\d*\.?\d+)px$/);
    if (px && !disabledRules.has('px')) return String(Number(px[1]));
    return v;
  }
  if (typeof v === 'number') return String(v);
  return JSON.stringify(v);
}

/**
 * The alias TARGET a value points at, or null when the value is a literal.
 * `raw` skips RULE alias — that is what the `--no-rule=alias` probe needs so
 * the dotted DTCG target and the slashed Figma target stop matching.
 */
const aliasTarget = (v: unknown, raw = false): string | null => {
  if (typeof v !== 'string') return null;
  const m = v.match(ALIAS_RE);
  if (!m) return null;
  return raw ? m[1] : m[1].split('.').join('/');
};

// ---------------------------------------------------------------------------
// The EXTRACTED side — and the provenance refusal that keeps this honest.
// ---------------------------------------------------------------------------
interface SnapVariable {
  name: string;
  type?: string;
  values: Record<string, unknown>;
}
interface Snapshot {
  fileKey?: unknown;
  extractedAt?: unknown;
  fileName?: unknown;
  collections?: Array<{ name: string; modes?: string[]; variables: SnapVariable[] }>;
}

const snapshot: Snapshot = JSON.parse(readFileSync(path.resolve(ROOT, snapshotPath), 'utf8'));

console.log(`TOKEN SNAPSHOT COMPARATOR — derived from tokens/  ⟷  ${snapshotPath}\n`);

const provenanceFailures: string[] = [];
if (typeof snapshot.fileKey !== 'string' || snapshot.fileKey.length === 0) {
  provenanceFailures.push(
    'no `fileKey` — the snapshot cannot name the Figma file it describes, so this comparison ' +
      'has no live side and would be a tautology',
  );
}
if (typeof snapshot.extractedAt !== 'number' || !Number.isFinite(snapshot.extractedAt)) {
  provenanceFailures.push(
    'no `extractedAt` — the snapshot cannot say when it was taken, so its staleness is unknowable',
  );
}
if (!Array.isArray(snapshot.collections) || snapshot.collections.length === 0) {
  provenanceFailures.push('no `collections` array — there is nothing to compare against');
}
if (provenanceFailures.length > 0) {
  console.error('✖ REFUSED — the snapshot has no provenance:');
  for (const f of provenanceFailures) console.error(`    · ${f}`);
  console.error(
    '\n  Both fields are stamped by parity/extract-figma.plugin.js (a human running it inside the\n' +
      '  live Figma file). A snapshot without them may have been derived from tokens/, in which case\n' +
      '  this gate would be comparing tokens/ against itself and proving nothing. Re-extract.',
  );
  process.exit(1);
}

const fileKey = snapshot.fileKey as string;
const extractedAt = snapshot.extractedAt as number;
const ageDays = (Date.now() - extractedAt) / 86_400_000;
const stale = ageDays > MAX_SNAPSHOT_AGE_DAYS;

// The anchor cross-check: the snapshot must describe the file the contracts
// point at. Missing anchors is a warning (a fresh tree has none); a MISMATCH
// is a refusal — a snapshot of some other file is not evidence about this one.
let anchorFileKey: string | null = null;
try {
  const contractsDir = path.join(ROOT, 'contracts');
  const first = readdirSync(contractsDir)
    .filter((f) => f.endsWith('.contract.json'))
    .sort()[0];
  if (first) {
    const c = JSON.parse(readFileSync(path.join(contractsDir, first), 'utf8')) as {
      anchors?: { figma?: { fileKey?: string } };
    };
    anchorFileKey = c.anchors?.figma?.fileKey ?? null;
  }
} catch {
  /* no contracts dir — the provenance refusal above is the load-bearing check */
}

console.log('PROVENANCE');
console.log(`  fileKey      ${fileKey}${anchorFileKey ? (anchorFileKey === fileKey ? '  (= contracts anchor)' : '  ✖ contracts anchor is ' + anchorFileKey) : '  (no contract anchor to compare)'}`);
console.log(`  extractedAt  ${extractedAt}  (${new Date(extractedAt).toISOString()})`);
console.log(
  `  age          ${ageDays.toFixed(1)} days — max ${MAX_SNAPSHOT_AGE_DAYS} ` +
    `(MAX_SNAPSHOT_AGE_DAYS)${stale ? '  ⚠ STALE' : ''}`,
);
if (stale) {
  console.log(
    `  ⚠ This snapshot is ${ageDays.toFixed(1)} days old. A green result below means tokens/ matches\n` +
      `    the Figma file AS IT WAS on ${new Date(extractedAt).toISOString().slice(0, 10)} — nothing about the file today. Only a human\n` +
      `    running parity/extract-figma.plugin.js in the live file can move that date. Not an exit\n` +
      `    code by default (the fast lane has no Figma session); \`--strict-age\` makes it one.`,
  );
}
if (anchorFileKey && anchorFileKey !== fileKey) {
  console.error(
    `\n✖ REFUSED — the snapshot describes file ${fileKey} but the contracts anchor ${anchorFileKey}.`,
  );
  process.exit(1);
}
if (disabledRules.size > 0) {
  console.log(
    `\n  ⚠ FALSIFICATION PROBE ACTIVE — normalization rule(s) disabled: ${[...disabledRules].join(', ')}.\n` +
      `    Drifts below are the spelling gap that rule closes, not real drift.`,
  );
}

// ---------------------------------------------------------------------------
// The comparison.
// ---------------------------------------------------------------------------
type Drift =
  | { kind: 'collection-missing' | 'collection-extra'; where: string; detail: string }
  | { kind: 'modes'; where: string; detail: string }
  | { kind: 'name-missing' | 'name-extra'; where: string; detail: string }
  | { kind: 'value' | 'alias'; where: string; detail: string };

const drifts: Drift[] = [];
const expected = deriveExpected();
const snapByName = new Map(
  (snapshot.collections ?? []).map((c) => [c.name, c] as const),
);

let comparedVars = 0;
let comparedValues = 0;
let comparedAliases = 0;
/** Pairs where BOTH sides are absent — see the guard below. Reported, never
 *  counted as agreement. */
const bothAbsent: string[] = [];

for (const exp of expected) {
  const got = snapByName.get(exp.name);
  if (!got) {
    drifts.push({
      kind: 'collection-missing',
      where: exp.name,
      detail: `tokens/ implies a "${exp.name}" collection; the snapshot has none`,
    });
    continue;
  }
  const gotModes = got.modes ?? [];
  if (gotModes.join('|') !== exp.modes.join('|')) {
    drifts.push({
      kind: 'modes',
      where: exp.name,
      detail: `tokens/ implies modes [${exp.modes.join(', ')}], snapshot has [${gotModes.join(', ')}]`,
    });
  }
  const gotVars = new Map(got.variables.map((v) => [v.name, v] as const));

  for (const [name, perMode] of exp.variables) {
    const v = gotVars.get(name);
    if (!v) {
      drifts.push({
        kind: 'name-missing',
        where: `${exp.name}/${name}`,
        detail: 'exists in tokens/, no Figma variable in the snapshot',
      });
      continue;
    }
    comparedVars++;
    for (const [mode, want] of Object.entries(perMode)) {
      const have = v.values?.[mode];
      // Two axes, never both — a mode value is either a REFERENCE or a
      // LITERAL, and mixing them up is itself the drift. An alias that has
      // been flattened to a literal (or a literal promoted to an alias) is
      // reported on the alias axis, because "the graph changed shape" is a
      // different repair than "a number changed".
      //
      // The `--no-rule=alias` probe deliberately leaves the DTCG '{a.b}'
      // spelling unconverted, which makes both sides read as aliases with
      // different targets — so the phantom drifts it produces land here.
      const wantAlias = aliasTarget(want, disabledRules.has('alias'));
      const haveAlias = aliasTarget(have, false);
      if (wantAlias !== null || haveAlias !== null) {
        comparedAliases++;
        if (wantAlias !== haveAlias) {
          drifts.push({
            kind: 'alias',
            where: `${exp.name}/${name} [${mode}]`,
            detail:
              `alias target: tokens/ → ${wantAlias ?? `<literal ${JSON.stringify(want)}>`}, ` +
              `snapshot → ${haveAlias ?? `<literal ${JSON.stringify(have)}>`}`,
          });
        }
        continue;
      }
      // ABSENCE ON BOTH SIDES IS NOT A COMPARISON. `normalize(undefined)`
      // returns '<absent>', so a key missing from tokens/ AND missing from the
      // snapshot used to compare EQUAL here and increment comparedValues — a
      // pair of holes scored as a match, inflating the denominator with
      // agreements about nothing. Measured by the adversarial pass: deleting a
      // key from one brand mode file left the total unchanged and reported no
      // drift. A both-absent pair is now counted separately and named.
      if (want === undefined && have === undefined) {
        bothAbsent.push(`${exp.name}/${name} [${mode}]`);
        continue;
      }
      comparedValues++;
      if (normalize(want) !== normalize(have)) {
        drifts.push({
          kind: 'value',
          where: `${exp.name}/${name} [${mode}]`,
          detail: `tokens/ says ${JSON.stringify(want)} → ${normalize(want)}; snapshot says ${JSON.stringify(have)} → ${normalize(have)}`,
        });
      }
    }
  }
  for (const name of gotVars.keys()) {
    if (!exp.variables.has(name)) {
      drifts.push({
        kind: 'name-extra',
        where: `${exp.name}/${name}`,
        detail: 'Figma variable in the snapshot has no counterpart in tokens/',
      });
    }
  }
}
for (const c of snapshot.collections ?? []) {
  if (!expected.some((e) => e.name === c.name)) {
    drifts.push({
      kind: 'collection-extra',
      where: c.name,
      detail: `snapshot has a "${c.name}" collection tokens/ does not imply`,
    });
  }
}

// ---------------------------------------------------------------------------
// Report.
// ---------------------------------------------------------------------------
const expectedVarCount = expected.reduce((n, c) => n + c.variables.size, 0);
const snapVarCount = (snapshot.collections ?? []).reduce((n, c) => n + c.variables.length, 0);

console.log('\nTABLE');
for (const exp of expected) {
  const got = snapByName.get(exp.name);
  console.log(
    `  ${exp.name.padEnd(11)} tokens/ ${String(exp.variables.size).padStart(3)}   snapshot ${String(got?.variables.length ?? 0).padStart(3)}   modes [${exp.modes.join(', ')}]`,
  );
}
console.log(`  ${'TOTAL'.padEnd(11)} tokens/ ${String(expectedVarCount).padStart(3)}   snapshot ${String(snapVarCount).padStart(3)}`);
console.log(
  `\n  compared ${comparedVars} variable name(s), ${comparedValues + comparedAliases} mode value(s) = ${comparedValues} literal(s) + ${comparedAliases} alias target(s)`,
);
if (bothAbsent.length > 0) {
  console.log(`  ${bothAbsent.length} pair(s) absent on BOTH sides — reported, not counted as agreement: ${bothAbsent.slice(0, 4).join(', ')}${bothAbsent.length > 4 ? ' …' : ''}`);
}

// THE DENOMINATOR FLOOR. Without this the gate passed on an EMPTY corpus:
// blanking tokens/ and stripping the snapshot's variables printed
// "✔ 0/0 variables match" and exited 0 — reproduced verbatim by the
// adversarial pass. That is the failure this repo keeps finding (a check that
// is green because it compared nothing), and it is worse here than elsewhere
// because this gate's whole claim is a RATIO of its own derivation.
//
// The floor is deliberately a MEASURED constant, not `> 0`. At the time of
// writing tokens/ derives 282 variables across 4 collections; a change that
// halves that is either a real deletion worth failing on or a broken derivation
// worth failing on, and both should stop the lane rather than quietly shrink
// the denominator. Raise it when the corpus legitimately grows.
const MIN_VARIABLES = 200;
const MIN_COLLECTIONS = 3;
if (expectedVarCount < MIN_VARIABLES || expected.length < MIN_COLLECTIONS) {
  console.error(
    `\n✖ REFUSED — the derived corpus is too small to be evidence: ${expectedVarCount} variable(s) across ${expected.length} collection(s), ` +
      `floor is ${MIN_VARIABLES}/${MIN_COLLECTIONS}.\n` +
      '  A ratio of a corpus this size proves nothing, and "0/0 match" is the shape this floor exists to refuse.\n' +
      '  Either tokens/ lost content, or the derivation stopped seeing it — both are failures, neither is a pass.',
  );
  process.exit(1);
}

if (drifts.length > 0) {
  const byKind = new Map<string, number>();
  for (const d of drifts) byKind.set(d.kind, (byKind.get(d.kind) ?? 0) + 1);
  console.error(`\n✖ ${drifts.length} drift(s) — ${[...byKind].map(([k, n]) => `${k}:${n}`).join(', ')}\n`);
  for (const d of drifts) {
    console.error(`  [${d.kind}] ${d.where}`);
    console.error(`     ${d.detail}`);
  }
  console.error(
    `\n  The derived table (tokens/) and the extracted table (${snapshotPath}) disagree.\n` +
      '  Either tokens/ moved and the Figma file did not (push: npm run figma:plan → run figma-sync/01-tokens.js),\n' +
      '  or the Figma file moved and tokens/ did not (promote: adopt the values into tokens/, npm run tokens).',
  );
  process.exit(1);
}

if (strictAge && stale) {
  console.error(
    `\n✖ REFUSED (--strict-age) — ${expectedVarCount}/${expectedVarCount} match, but against a snapshot\n` +
      `  ${ageDays.toFixed(1)} days old (max ${MAX_SNAPSHOT_AGE_DAYS}). Re-extract before trusting this as evidence about the live file.`,
  );
  process.exit(1);
}

// THE SUCCESS LINE NAMES BOTH SIDES. It used to print
// `${expectedVarCount}/${expectedVarCount}` — the derived count over ITSELF,
// which can never be anything but N/N however badly the two artifacts
// disagree, and which hides the snapshot entirely. It now prints what was
// actually compared against what, so a reader can see the two independent
// populations and their overlap.
console.log(
  `\n✔ tokens/ derives ${expectedVarCount} variable(s); the extracted snapshot holds ${snapVarCount}; ` +
    `${comparedVars} matched by name and every one agreed on every mode value (${comparedValues}) and alias target (${comparedAliases})` +
    (stale ? ` — against a snapshot ${ageDays.toFixed(1)} days old (see the STALE line above).` : '.'),
);
