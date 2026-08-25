/**
 * THE CHANNEL-TABLE GATE — `npm run channel-table:check`
 *
 *   npx tsx scripts/channel-table-check.ts               # verify
 *   npx tsx scripts/channel-table-check.ts --self-test   # the gate must go red on planted reds
 *
 * WHAT IT HOLDS. spec/channel-table.json is the TOP-DOWN closure of the
 * channel vocabulary: every CSS computed property the capture layer can
 * observe, classified into exactly one of CARRIED / LEDGERED / REFUSED /
 * INERT. The bottom-up habit this replaces — classify whatever the next
 * library exercises — is why every new design system "found" an unclassified
 * property. This gate makes the closure a machine-checked invariant:
 *
 *   1. COVERAGE — every property observed by the capture layer (the union of
 *      `_provenance.channels` across the committed capture artifacts under
 *      extract/computed/out/) has a table row. A Chromium upgrade that
 *      enumerates a new longhand goes RED here until the property is
 *      classified. Custom properties (--*) are covered by the table's
 *      customProperties rule, never row-by-row.
 *   2. DOOR CLOSURE — every schema channel (DECLARED_CHANNELS,
 *      TOKEN_CHANNELS, LITERAL_CHANNELS), every SYNTHETIC channel, and every
 *      css-dom conformance observable channel has a row; every
 *      LOGICAL_ALIASES member is classified INERT (its physical twin carries
 *      the fact — if that ever stops being true the alias must be
 *      reclassified, loudly).
 *   3. ANCHORS — every CARRIED row cites engine {file, symbol} pairs that
 *      exist in the tree. A refactor that deletes or renames a projection
 *      function goes RED here instead of leaving the table citing a ghost.
 *   4. BYTE STABILITY — the JSON is canonical (2-space, sorted rows,
 *      trailing newline) so a regeneration is a no-op diff, and the totals
 *      quoted in spec/CHANNEL-TABLE.md and docs/30-channel-table.md are the
 *      recomputed ones, never a stale copy.
 *
 * WHAT IT DOES NOT CLAIM. A row is a CLASSIFICATION, not a proof of
 * behaviour — the conformance kits (91 css-dom + 157 canvas cases) are the
 * executable half; rows cite their case ids. The two FC codes the table
 * mints (FC-PSEUDO-PLANE-UNREAD, FC-STATE-PLANE-UNDRIVEN) name loss classes
 * that are still silent in the engine; the table is where they stop being
 * unnamed, and wiring live receipts is follow-up work by design.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DECLARED_CHANNELS, TOKEN_CHANNELS, LITERAL_CHANNELS } from '@ds-contracts/schema';
import { LOGICAL_ALIASES, SYNTHETIC_CHANNELS } from '../extract/computed/lib.js';

const ROOT = process.cwd();
const TABLE_PATH = path.join(ROOT, 'spec/channel-table.json');
const MD_PATH = path.join(ROOT, 'spec/CHANNEL-TABLE.md');
const DOCS_PATH = path.join(ROOT, 'docs/30-channel-table.md');

const CLASSES = new Set(['CARRIED', 'LEDGERED', 'REFUSED', 'INERT']);

interface Anchor {
  file: string;
  symbol: string;
}
interface Row {
  property: string;
  class: string;
  prior: string;
  projection?: string;
  engine?: Anchor[];
  receipt?: string;
  code?: string;
  note?: string;
  valueNotes?: string;
  conformance?: string[];
  synthetic?: boolean;
}
interface Table {
  propertyCount: number;
  totals: Record<string, number>;
  unclassifiedBeforeThisTable: number;
  properties: Row[];
  customProperties: { engine: Anchor[] };
  planes: {
    pseudoElements: { read: string[]; readAnchor: Anchor; unread: { items: string[] } };
    states: { driven: string[]; drivenAnchor: Anchor; undriven: { items: string[] } };
  };
  foundSilent: Array<{ surface: string; items: string[] }>;
}

/** The union of standard (non-custom) properties the committed capture
 *  artifacts record — the gate's definition of "observed by the capture
 *  layer". Pure read; refuses to answer from an empty denominator. */
function observedProperties(): { observed: Set<string>; artifacts: number } {
  const outDir = path.join(ROOT, 'extract/computed/out');
  const observed = new Set<string>();
  let artifacts = 0;
  if (!existsSync(outDir)) return { observed, artifacts };
  for (const lib of readdirSync(outDir)) {
    const truth = path.join(outDir, lib, 'captured-truth.json');
    if (!existsSync(truth)) continue;
    try {
      const channels: unknown = JSON.parse(readFileSync(truth, 'utf8'))?._provenance?.channels;
      if (!Array.isArray(channels)) continue;
      artifacts++;
      for (const c of channels) if (typeof c === 'string' && !c.startsWith('--')) observed.add(c);
    } catch {
      // an unreadable artifact is not this gate's finding; drift gates own it
    }
  }
  return { observed, artifacts };
}

function verify(raw: string, readFile: (rel: string) => string | null): string[] {
  const problems: string[] = [];
  let table: Table;
  try {
    table = JSON.parse(raw) as Table;
  } catch (e) {
    return [`spec/channel-table.json does not parse: ${(e as Error).message}`];
  }

  // 4 — canonical bytes: a regeneration must be a no-op diff.
  const canonical = JSON.stringify(table, null, 2) + '\n';
  if (canonical !== raw) problems.push('spec/channel-table.json is not in canonical form (JSON.stringify(table, null, 2) + newline) — regenerate instead of hand-tweaking bytes');

  const rows = new Map<string, Row>();
  const totals: Record<string, number> = { CARRIED: 0, LEDGERED: 0, REFUSED: 0, INERT: 0 };
  let debt = 0;
  let prev = '';
  for (const r of table.properties) {
    if (rows.has(r.property)) problems.push(`duplicate row: ${r.property}`);
    rows.set(r.property, r);
    if (r.property.localeCompare(prev) < 0) problems.push(`rows not sorted at ${r.property}`);
    prev = r.property;
    if (!CLASSES.has(r.class)) {
      problems.push(`${r.property}: class "${r.class}" is not one of CARRIED/LEDGERED/REFUSED/INERT`);
      continue;
    }
    totals[r.class]++;
    if (r.prior === 'none') debt++;
    if (r.class === 'CARRIED' && (!r.engine || r.engine.length === 0)) problems.push(`${r.property}: CARRIED without an engine anchor`);
    if (r.class === 'CARRIED' && !r.projection) problems.push(`${r.property}: CARRIED without a named Figma projection`);
    if (r.class === 'LEDGERED' && !r.receipt) problems.push(`${r.property}: LEDGERED without a named receipt channel`);
    if (r.class === 'REFUSED' && !r.code) problems.push(`${r.property}: REFUSED without a named wall code`);
    if (r.class === 'INERT' && !r.note) problems.push(`${r.property}: INERT without a justification`);
  }

  // totals + debt are recomputed, never trusted from the file.
  for (const k of CLASSES) {
    if (table.totals[k] !== totals[k]) problems.push(`totals.${k} says ${table.totals[k]}, rows say ${totals[k]}`);
  }
  if (table.propertyCount !== table.properties.length) problems.push(`propertyCount ${table.propertyCount} != ${table.properties.length} rows`);
  if (table.unclassifiedBeforeThisTable !== debt) problems.push(`unclassifiedBeforeThisTable says ${table.unclassifiedBeforeThisTable}, rows with prior:"none" say ${debt}`);

  // 1 — coverage over the committed capture artifacts.
  const { observed, artifacts } = observedProperties();
  if (artifacts === 0) {
    problems.push('no committed capture artifact with _provenance.channels found under extract/computed/out/ — the coverage half of this gate cannot run, and a gate that cannot observe must refuse');
  } else {
    for (const p of observed) {
      if (!rows.has(p)) problems.push(`property observed by the capture layer but ABSENT from the table: ${p} (classify it — the whole point of the table is that this can never be silent)`);
    }
  }

  // 2 — door closure.
  for (const ch of [...Object.keys(DECLARED_CHANNELS), ...Object.keys(TOKEN_CHANNELS), ...LITERAL_CHANNELS]) {
    if (!rows.has(ch)) problems.push(`schema channel with no table row: ${ch}`);
  }
  for (const ch of SYNTHETIC_CHANNELS) {
    if (!rows.has(ch)) problems.push(`synthetic channel with no table row: ${ch}`);
  }
  for (const alias of LOGICAL_ALIASES) {
    const r = rows.get(alias);
    if (!r) problems.push(`LOGICAL_ALIASES member with no table row: ${alias}`);
    else if (r.class !== 'INERT') problems.push(`${alias}: LOGICAL_ALIASES member classified ${r.class} — the alias exclusion in isFusable is only justified while the row is INERT with its physical twin carrying the fact`);
  }
  try {
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'conformance/MANIFEST.json'), 'utf8')) as {
      cases: Array<{ id: string; observable?: { channel?: string } }>;
    };
    for (const c of manifest.cases) {
      const ch = c.observable?.channel;
      if (!ch || ch.startsWith('__')) continue;
      if (!rows.has(ch)) problems.push(`conformance case ${c.id} observes channel "${ch}" with no table row`);
    }
  } catch (e) {
    problems.push(`conformance/MANIFEST.json unreadable: ${(e as Error).message}`);
  }

  // 3 — anchors exist (utf8 read keeps NUL-carrying files greppable — the
  // grep -a lesson, applied to the instrument).
  const anchorSets: Array<[string, Anchor[] | undefined]> = [
    ...table.properties.map((r): [string, Anchor[] | undefined] => [r.property, r.engine]),
    ['customProperties', table.customProperties?.engine],
    ['planes.pseudoElements', table.planes?.pseudoElements ? [table.planes.pseudoElements.readAnchor] : undefined],
    ['planes.states', table.planes?.states ? [table.planes.states.drivenAnchor] : undefined],
  ];
  const fileCache = new Map<string, string | null>();
  for (const [who, anchors] of anchorSets) {
    for (const a of anchors ?? []) {
      let content = fileCache.get(a.file);
      if (content === undefined) {
        content = readFile(a.file);
        fileCache.set(a.file, content);
      }
      if (content === null) problems.push(`${who}: cited engine file does not exist: ${a.file}`);
      else if (!content.includes(a.symbol)) problems.push(`${who}: cited symbol not found in ${a.file}: ${JSON.stringify(a.symbol)} — the table cites a ghost`);
    }
  }

  // 4 — the prose surfaces quote the recomputed numbers.
  const total = table.properties.length;
  const expect = [
    `| CARRIED | ${totals.CARRIED} |`,
    `| LEDGERED | ${totals.LEDGERED} |`,
    `| REFUSED | ${totals.REFUSED} |`,
    `| INERT | ${totals.INERT} |`,
    `**${total}**`,
  ];
  for (const [rel, needles] of [
    ['spec/CHANNEL-TABLE.md', expect],
    ['docs/30-channel-table.md', [`${total} properties`, `${totals.CARRIED} CARRIED`, `${totals.LEDGERED} LEDGERED`, `${totals.REFUSED} REFUSED`, `${totals.INERT} INERT`, `${debt} of the ${total}`]],
  ] as Array<[string, string[]]>) {
    const md = readFile(rel);
    if (md === null) {
      problems.push(`${rel} is missing`);
      continue;
    }
    for (const n of needles) if (!md.includes(n)) problems.push(`${rel} does not quote ${JSON.stringify(n)} — its numbers drifted from the table`);
  }

  return problems;
}

const realRead = (rel: string): string | null => {
  const p = path.join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
};

const raw = readFileSync(TABLE_PATH, 'utf8');

if (process.argv.includes('--self-test')) {
  // A gate that cannot go red is not a gate. Three planted reds:
  const clean = verify(raw, realRead);
  if (clean.length > 0) {
    console.error(`channel-table self-test needs a green baseline; the real table is RED:\n  ${clean.join('\n  ')}`);
    process.exit(1);
  }
  const t = JSON.parse(raw) as Table;
  // (a) delete an observed property's row — coverage must refuse by name.
  const dropped = { ...t, properties: t.properties.filter((r) => r.property !== 'background-color') };
  const a = verify(JSON.stringify(dropped, null, 2) + '\n', realRead);
  if (!a.some((p) => p.includes('background-color') && p.includes('ABSENT'))) {
    console.error(`self-test (a) FAILED: dropping the background-color row did not refuse by name. Got:\n  ${a.join('\n  ')}`);
    process.exit(1);
  }
  // (b) point a CARRIED anchor at a ghost symbol — anchors must refuse.
  const ghosted = JSON.parse(raw) as Table;
  const carried = ghosted.properties.find((r) => r.class === 'CARRIED' && r.engine);
  carried!.engine![0] = { ...carried!.engine![0], symbol: 'no_such_symbol_planted_by_self_test(' };
  const b = verify(JSON.stringify(ghosted, null, 2) + '\n', realRead);
  if (!b.some((p) => p.includes('no_such_symbol_planted_by_self_test'))) {
    console.error(`self-test (b) FAILED: a planted ghost symbol did not refuse. Got:\n  ${b.join('\n  ')}`);
    process.exit(1);
  }
  // (c) a hand-tweaked byte — canonical form must refuse.
  const c = verify(raw + '\n', realRead);
  if (!c.some((p) => p.includes('canonical'))) {
    console.error(`self-test (c) FAILED: a non-canonical byte did not refuse. Got:\n  ${c.join('\n  ')}`);
    process.exit(1);
  }
  console.log('✔ channel-table self-test: a dropped observed row, a ghost CARRIED anchor and a non-canonical byte each go red by name');
  process.exit(0);
}

const problems = verify(raw, realRead);
if (problems.length > 0) {
  console.error(`CHANNEL TABLE REFUSED — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✖ ${p}`);
  process.exit(1);
}
const t = JSON.parse(raw) as Table;
const { observed, artifacts } = observedProperties();
console.log(
  `✔ channel table closed: ${t.properties.length} properties (${t.totals.CARRIED} carried · ${t.totals.LEDGERED} ledgered · ${t.totals.REFUSED} refused · ${t.totals.INERT} inert) cover the ${observed.size} observed by ${artifacts} committed capture artifact(s); every schema/conformance channel has a row; every CARRIED anchor exists; bytes canonical`,
);
