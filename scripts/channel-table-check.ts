/**
 * THE CHANNEL-TABLE GATE — `npm run channel-table:check`
 *
 *   npx tsx scripts/channel-table-check.ts               # verify
 *   npx tsx scripts/channel-table-check.ts --self-test   # the gate must go red on planted reds
 *   npx tsx scripts/channel-table-check.ts --rederive    # rewrite the DERIVED fields from the manifests
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
 *   5. EVIDENCE — every CARRIED row declares WHICH claim it is making:
 *      `measured` (a named case observes it end to end), `code-cited` (an
 *      engine citation and nothing more — a declared gap), or `unobservable`
 *      (no contract can even spell the channel, so no case could ever
 *      observe it). The state is RE-DERIVED from the two manifests and the
 *      schema's channel sets, never trusted from the file, so a row can
 *      neither over-claim nor under-claim; `--rederive` writes what the
 *      derivation says. Cites are checked in BOTH directions — until
 *      2026-08-26 only manifest→table was verified, so the table could cite
 *      a case that had been deleted, renamed, or that measures some other
 *      channel entirely.
 *
 * WHAT IT DOES NOT CLAIM. A row is a CLASSIFICATION, not a proof of
 * behaviour — the conformance kits (127 css-dom + 157 canvas cases) are the
 * executable half, and the `evidence` field is now the honest record of how
 * many rows the executable half actually reaches. The two FC codes the table
 * mints (FC-PSEUDO-PLANE-UNREAD, FC-STATE-PLANE-UNDRIVEN) name loss classes
 * that are still silent in the engine; the table is where they stop being
 * unnamed, and wiring live receipts is follow-up work by design.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DECLARED_CHANNELS, TOKEN_CHANNELS, LITERAL_CHANNELS } from '@ds-contracts/schema';
import { LOGICAL_ALIASES, SYNTHETIC_CHANNELS } from '../extract/computed/lib.js';
import { MIRRORED_CHANNELS } from '../conformance/run.js';

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
  /** CARRIED only — see EVIDENCE_STATES. */
  evidence?: string;
  /** CARRIED only — the channel this property is OBSERVED under when it is
   *  folded at the read boundary and therefore has no spelling of its own in
   *  a contract (`-webkit-text-fill-color` folds into `color`). Legal ONLY on
   *  a row whose own property is unreachable; otherwise it would let a row
   *  borrow a neighbour's case and call itself measured. */
  observedAs?: string;
}
interface Table {
  /** Provenance. `doors` is prose EXCEPT for the case counts two of its
   *  entries quote from the two conformance manifests — those are DERIVED,
   *  and `--rederive` owns them (see deriveDoors). */
  generatedFrom?: { doors?: string[] } & Record<string, unknown>;
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

// ---------------------------------------------------------------------------
// EVIDENCE — what backs a CARRIED verdict
// ---------------------------------------------------------------------------
/**
 * A CARRIED row used to mean two different things wearing one word:
 *
 *   "there is a code path that carries this"   (an `engine` citation)
 *   "we measured that it carries"              (a conformance case)
 *
 * Only 27 of the first 82 CARRIED rows had the second. The gate could not
 * tell the difference, so neither could a reader — and on 2026-08-26 two of
 * the rows resting on a citation alone turned out to be things the css-dom
 * fixture's reader could not observe AT ALL: no case could ever have caught
 * them, and nothing in the tree could have noticed. `evidence` is the field
 * that stops the two claims sharing a word.
 *
 *   measured      a named case observes this property end to end (capture →
 *                 contract). A change that broke the property turns something
 *                 red. `conformance` names the case(s), and this gate checks
 *                 they exist and that a css-dom case really observes THIS
 *                 channel.
 *   code-cited    an engine citation and nothing more. The property is
 *                 REACHABLE — a case could be written — but none has been.
 *                 A declared gap, and the honest state for most of the table.
 *   unobservable  no reader path exists: the property is in none of the
 *                 schema's channel sets and no structured mirror spells it,
 *                 so it cannot appear in a contract, so no conformance case
 *                 could ever observe it. The strongest possible statement
 *                 that a claim is unfalsifiable as things stand.
 *
 * The state is DERIVED (deriveEvidence), never trusted from the file, and
 * `--rederive` writes what the derivation says. One function, so the check
 * and the fix cannot drift apart.
 */
const EVIDENCE_STATES = new Set(['measured', 'code-cited', 'unobservable']);

export const REDERIVE_HINT =
  'run `npm run channel-table:rederive` (it re-derives evidence, the css-dom half of `conformance`, and the case counts `generatedFrom.doors` quotes — every other hand-written field survives verbatim)';

/** Every channel a CONTRACT can spell, and therefore the only channels a
 *  conformance case can ever observe end to end: the schema's three channel
 *  sets (whose keys ARE CSS spellings) plus the structured mirrors that
 *  conformance/run.ts writes out of `Part.layout` / `Part.placement`. The
 *  mirror list is imported rather than restated so a mirror added there and
 *  not here cannot silently widen this set. */
function reachableChannels(): Set<string> {
  return new Set<string>([
    ...Object.keys(DECLARED_CHANNELS),
    ...Object.keys(TOKEN_CHANNELS),
    ...LITERAL_CHANNELS,
    ...MIRRORED_CHANNELS,
  ]);
}

interface Manifests {
  /** css-dom: observable channel → the case ids that observe it. */
  cssByChannel: Map<string, string[]>;
  /** css-dom: case id → the channel it observes. */
  cssChannelOf: Map<string, string>;
  /** canvas: the case ids that exist (their checks are regexes, not channels,
   *  so a canvas cite is HAND-declared and only its existence is derivable). */
  canvasIds: Set<string>;
  /** TOTAL cases per manifest — NOT the map sizes above. `cssChannelOf` skips
   *  a case with no observable channel and every `__`-prefixed synthetic one,
   *  so its size is not the denominator and must never be used as one. */
  caseCounts: Map<string, number>;
}

export function loadManifests(readFile: (rel: string) => string | null): Manifests {
  const cssByChannel = new Map<string, string[]>();
  const cssChannelOf = new Map<string, string>();
  const canvasIds = new Set<string>();
  const css = readFile('conformance/MANIFEST.json');
  if (css !== null) {
    for (const c of (JSON.parse(css) as { cases: Array<{ id: string; observable?: { channel?: string } }> }).cases) {
      const ch = c.observable?.channel;
      if (!ch || ch.startsWith('__')) continue;
      cssChannelOf.set(c.id, ch);
      (cssByChannel.get(ch) ?? cssByChannel.set(ch, []).get(ch)!).push(c.id);
    }
  }
  const canvas = readFile('extract/figma/conformance/MANIFEST.json');
  if (canvas !== null) {
    for (const c of (JSON.parse(canvas) as { cases: Array<{ id: string }> }).cases) canvasIds.add(c.id);
  }
  const caseCounts = new Map<string, number>();
  for (const rel of MANIFEST_PATHS) {
    const t = rel === 'conformance/MANIFEST.json' ? css : canvas;
    if (t !== null) caseCounts.set(rel, (JSON.parse(t) as { cases: unknown[] }).cases.length);
  }
  return { cssByChannel, cssChannelOf, canvasIds, caseCounts };
}

/** THE TWO MANIFESTS whose case COUNT `generatedFrom.doors` quotes. A door
 *  entry naming one of these paths carries a number that is a fact about that
 *  file, not prose — so the remedy owns it. */
export const MANIFEST_PATHS = ['conformance/MANIFEST.json', 'extract/figma/conformance/MANIFEST.json'] as const;

/** THE DOORS DERIVATION. `generatedFrom.doors` is provenance prose, and two of
 *  its entries embed a case count quoted from a manifest — exactly the kind of
 *  number that rots. Until 2026-08-26 `--rederive` did not own them: it
 *  reported "0 field(s) re-derived" and exited GREEN while the string said 112
 *  and the manifest said 115, so the remedy CERTIFIED a register it had left
 *  wrong. That is the defect `door-register:rederive` was repaired for on the
 *  same day, in the same shape, and it is closed here the same way.
 *
 *  Returns the corrected door list plus anything it REFUSES to derive. An
 *  entry that names a manifest but whose count this reader cannot parse is
 *  named, never silently passed over: a derivation that declines in silence is
 *  how the field rotted in the first place. */
export function deriveDoors(doors: string[], m: Manifests): { doors: string[]; refusals: string[] } {
  const refusals: string[] = [];
  const out = doors.map((entry) => {
    const rel = MANIFEST_PATHS.find((path) => entry.startsWith(`${path} (`));
    if (rel === undefined) return entry; // ordinary provenance prose — untouched
    const want = m.caseCounts.get(rel);
    if (want === undefined) {
      refusals.push(`generatedFrom.doors names ${rel}, which could not be read — its quoted case count cannot be derived`);
      return entry;
    }
    const hit = /^(.*\()(\d+)(\D.*)$/.exec(entry);
    if (!hit) {
      refusals.push(`generatedFrom.doors entry for ${rel} quotes no case count this reader can find ("${entry}") — the shape is "<path> (<N> ... cases)"; fix the entry or stop naming a manifest in it`);
      return entry;
    }
    return `${hit[1]}${want}${hit[3]}`;
  });
  return { doors: out, refusals };
}

/** THE DERIVATION. Returns what a CARRIED row's `evidence` and `conformance`
 *  MUST be, given the manifests and the reachability of its channel. Called
 *  by `verify` (to refuse a row that disagrees) and by `--rederive` (to write
 *  the agreement) — the door-register discipline. */
export function deriveEvidence(
  r: Row,
  m: Manifests,
  reachable: Set<string>,
): { evidence: string; conformance: string[] } {
  const target = r.observedAs ?? r.property;
  // css-dom cites are DERIVED: a case that observes this channel is evidence
  // for this row whether or not a human remembered to write it down.
  //
  // EXCEPT under a fold. When `observedAs` redirects the row to a neighbour's
  // channel, "every case on that channel" is far too generous — of the nine
  // cases that observe `color`, exactly one sets `-webkit-text-fill-color`
  // and so exercises the fold. Which case exercises a fold is a human
  // judgement, so a folded row's cites are preserved and merely validated,
  // never invented.
  const fromCss = r.observedAs === undefined
    ? (m.cssByChannel.get(target) ?? [])
    : (r.conformance ?? []).filter((id) => m.cssChannelOf.get(id) === target);
  // canvas cites are PRESERVED for the same reason: canvas cases assert on
  // regexes, not on a CSS channel, so which row a canvas case supports is a
  // human judgement. The gate keeps it and checks only that the case exists.
  const fromCanvas = (r.conformance ?? []).filter((id) => m.canvasIds.has(id));
  const conformance = [...new Set([...fromCss, ...fromCanvas])].sort();
  if (conformance.length > 0) return { evidence: 'measured', conformance };
  if (!reachable.has(target)) return { evidence: 'unobservable', conformance: [] };
  return { evidence: 'code-cited', conformance: [] };
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

  // 4b — generatedFrom.doors: the case counts it quotes are DERIVED.
  {
    const doors = table.generatedFrom?.doors;
    if (doors !== undefined) {
      const d = deriveDoors(doors, loadManifests(readFile));
      for (const r of d.refusals) problems.push(r);
      doors.forEach((entry, i) => {
        if (d.doors[i] !== entry) {
          problems.push(`generatedFrom.doors[${i}] is stale: reads "${entry}", the manifest gives "${d.doors[i]}". ${REDERIVE_HINT}`);
        }
      });
    }
  }

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
    if (r.class !== 'CARRIED') {
      if (r.evidence !== undefined) problems.push(`${r.property}: ${r.class} carries an "evidence" field — evidence states are a CARRIED-only claim`);
      if (r.observedAs !== undefined) problems.push(`${r.property}: ${r.class} carries an "observedAs" field — the read-boundary fold is a CARRIED-only claim`);
    }
  }

  // 5 — EVIDENCE. Every CARRIED row must say WHICH of the two claims it is
  // making, and the state is recomputed from the manifests rather than
  // trusted, so a row can neither over-claim ("measured" with no case) nor
  // under-claim ("code-cited" while a case that measures it already exists).
  const reachable = reachableChannels();
  const m = loadManifests(readFile);
  if (m.cssByChannel.size === 0) {
    problems.push('conformance/MANIFEST.json yielded ZERO observable channels — the evidence half of this gate cannot run, and a gate that cannot observe must refuse');
  }
  if (m.canvasIds.size === 0) {
    problems.push('extract/figma/conformance/MANIFEST.json yielded ZERO canvas case ids — the evidence half of this gate cannot run, and a gate that cannot observe must refuse');
  }
  const evidenceCounts: Record<string, number> = { measured: 0, 'code-cited': 0, unobservable: 0 };
  for (const r of table.properties) {
    if (r.class !== 'CARRIED') continue;

    // A cite must name a case that EXISTS, in one of the two manifests. The
    // manifest→table direction was already checked; this is the reverse one,
    // and without it the table could cite a case that was deleted or renamed.
    for (const id of r.conformance ?? []) {
      if (!m.cssChannelOf.has(id) && !m.canvasIds.has(id)) {
        problems.push(`${r.property}: cites conformance case "${id}", which exists in NEITHER conformance/MANIFEST.json NOR extract/figma/conformance/MANIFEST.json — the table cites a ghost case`);
      } else if (m.cssChannelOf.has(id) && m.cssChannelOf.get(id) !== (r.observedAs ?? r.property)) {
        problems.push(`${r.property}: cites css-dom case "${id}", but that case observes channel "${m.cssChannelOf.get(id)}" — a case measures the channel it names, and citing it here claims a measurement nobody made`);
      }
    }

    if (r.observedAs !== undefined) {
      if (!rows.has(r.observedAs)) problems.push(`${r.property}: observedAs "${r.observedAs}" has no table row`);
      if (reachable.has(r.property)) {
        problems.push(`${r.property}: declares observedAs "${r.observedAs}" but "${r.property}" is itself a reachable channel — the fold is not needed, and borrowing another channel's case would launder a direct measurement nobody took`);
      }
    }

    if (r.evidence === undefined) {
      problems.push(`${r.property}: CARRIED without an "evidence" state — CARRIED must say whether it is MEASURED or merely code-cited (${[...EVIDENCE_STATES].join(' / ')}). ${REDERIVE_HINT}`);
      continue;
    }
    if (!EVIDENCE_STATES.has(r.evidence)) {
      problems.push(`${r.property}: evidence "${r.evidence}" is not one of ${[...EVIDENCE_STATES].join(' / ')}`);
      continue;
    }
    evidenceCounts[r.evidence]++;

    const want = deriveEvidence(r, m, reachable);
    if (r.evidence !== want.evidence) {
      problems.push(
        `${r.property}: evidence says "${r.evidence}" but the manifests derive "${want.evidence}"` +
          (want.evidence === 'measured' ? ` (case(s) ${want.conformance.join(', ')} already observe it)` : '') +
          (want.evidence === 'unobservable' ? ` ("${r.observedAs ?? r.property}" is in no schema channel set and no structured mirror, so no contract can spell it and no case can observe it)` : '') +
          `. ${REDERIVE_HINT}`,
      );
    }
    const have = [...(r.conformance ?? [])].sort();
    if (JSON.stringify(have) !== JSON.stringify(want.conformance)) {
      problems.push(`${r.property}: conformance cites [${have.join(', ')}] but the derivation gives [${want.conformance.join(', ')}]. ${REDERIVE_HINT}`);
    }
    if (r.evidence === 'measured' && want.conformance.length === 0) {
      problems.push(`${r.property}: evidence "measured" names no case — measured means a case measures it`);
    }
  }
  // Anti-zero: a field that nothing populates checks nothing. `code-cited`
  // reaching zero is the GOAL and is deliberately not guarded.
  if (totals.CARRIED > 0 && evidenceCounts.measured === 0) {
    problems.push('ZERO CARRIED rows are evidenced as "measured" — the evidence field has stopped being populated, and a vacuous field is not a check');
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

/** `--rederive`: recompute the two DERIVED fields on every CARRIED row and
 *  write them back. It touches `evidence` and the css-dom half of
 *  `conformance` and NOTHING else — `projection`, `engine`, `valueNotes`,
 *  `prior`, `note`, hand-declared canvas cites and `observedAs` are all
 *  hand-written and survive verbatim through the parse/serialize round trip.
 *  (#60's lesson: metadata with no remedy command rots. #62's lesson: never
 *  resolve a generated artifact by picking a side — re-derive it.) */
export function rederive(table: Table, m: Manifests, reachable: Set<string>): { moves: string[] } {
  const moves: string[] = [];
  const doors = table.generatedFrom?.doors;
  if (doors !== undefined) {
    const d = deriveDoors(doors, m);
    d.doors.forEach((want, i) => {
      if (want !== doors[i]) {
        moves.push(`generatedFrom.doors[${i}]: "${doors[i]}" → "${want}"`);
        doors[i] = want;
      }
    });
  }
  for (const r of table.properties) {
    if (r.class !== 'CARRIED') continue;
    const want = deriveEvidence(r, m, reachable);
    const had = r.evidence;
    const hadCites = JSON.stringify([...(r.conformance ?? [])].sort());
    r.evidence = want.evidence;
    if (want.conformance.length > 0) r.conformance = want.conformance;
    else delete r.conformance;
    if (had !== want.evidence) moves.push(`${r.property}: evidence ${had ?? '(none)'} → ${want.evidence}`);
    if (hadCites !== JSON.stringify(want.conformance)) moves.push(`${r.property}: conformance ${hadCites} → ${JSON.stringify(want.conformance)}`);
  }
  return { moves };
}

if (process.argv.includes('--rederive')) {
  const t = JSON.parse(raw) as Table;
  const { moves } = rederive(t, loadManifests(realRead), reachableChannels());
  writeFileSync(TABLE_PATH, JSON.stringify(t, null, 2) + '\n');
  console.log(`channel-table:rederive — ${moves.length} field(s) re-derived`);
  for (const l of moves) console.log(`  · ${l}`);
  const left = verify(readFileSync(TABLE_PATH, 'utf8'), realRead);
  if (left.length > 0) {
    console.error(`\n✖ still RED after rederive — these are NOT derivable and need a human:\n  ${left.join('\n  ')}`);
    process.exit(1);
  }
  console.log('✔ spec/channel-table.json re-derived and green');
  process.exit(0);
}

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
  // (d) strip a CARRIED row's evidence state — CARRIED must declare one.
  const stripped = JSON.parse(raw) as Table;
  const anyCarried = stripped.properties.find((r) => r.class === 'CARRIED')!;
  delete anyCarried.evidence;
  const d = verify(JSON.stringify(stripped, null, 2) + '\n', realRead);
  if (!d.some((p) => p.includes(anyCarried.property) && p.includes('without an "evidence" state'))) {
    console.error(`self-test (d) FAILED: a CARRIED row with no evidence state did not refuse. Got:\n  ${d.join('\n  ')}`);
    process.exit(1);
  }
  // (e) claim "measured" on a row the manifests say is only code-cited — the
  //     over-claim this whole field exists to stop.
  const overclaim = JSON.parse(raw) as Table;
  const cited = overclaim.properties.find((r) => r.class === 'CARRIED' && r.evidence === 'code-cited');
  if (!cited) {
    console.error('self-test (e) FAILED: no code-cited CARRIED row to over-claim with — the planted red cannot be built');
    process.exit(1);
  }
  cited.evidence = 'measured';
  const e = verify(JSON.stringify(overclaim, null, 2) + '\n', realRead);
  if (!e.some((p) => p.includes(cited.property) && p.includes('derive "code-cited"'))) {
    console.error(`self-test (e) FAILED: claiming "measured" with no case did not refuse. Got:\n  ${e.join('\n  ')}`);
    process.exit(1);
  }
  // (f) cite a case that does not exist — the reverse-direction check that was
  //     missing entirely until now (only manifest→table was ever verified).
  const ghostCase = JSON.parse(raw) as Table;
  const measured = ghostCase.properties.find((r) => r.class === 'CARRIED' && r.evidence === 'measured')!;
  measured.conformance = ['no_such_case_planted_by_self_test'];
  const f = verify(JSON.stringify(ghostCase, null, 2) + '\n', realRead);
  if (!f.some((p) => p.includes('no_such_case_planted_by_self_test') && p.includes('ghost case'))) {
    console.error(`self-test (f) FAILED: a cite naming a nonexistent case did not refuse. Got:\n  ${f.join('\n  ')}`);
    process.exit(1);
  }
  // (g) cite a REAL css-dom case that observes a DIFFERENT channel — the
  //     subtler half of (f): the case exists, so existence alone is no proof.
  const wrongCase = JSON.parse(raw) as Table;
  const wrongRow = wrongCase.properties.find((r) => r.class === 'CARRIED' && r.property === 'opacity')!;
  wrongRow.evidence = 'measured';
  wrongRow.conformance = ['color-hex'];
  const g = verify(JSON.stringify(wrongCase, null, 2) + '\n', realRead);
  if (!g.some((p) => p.includes('opacity') && p.includes('observes channel "color"'))) {
    console.error(`self-test (g) FAILED: citing a case that measures another channel did not refuse. Got:\n  ${g.join('\n  ')}`);
    process.exit(1);
  }
  // (i) a STALE case count inside generatedFrom.doors — the field the remedy
  //     did not own until 2026-08-26, and the reason it did not is the point:
  //     `--rederive` reported "0 field(s) re-derived" and exited GREEN while
  //     the string said 112 and the manifest said 115. A remedy that certifies
  //     a register it has left wrong is the door-register defect, again.
  {
    const staleDoors = JSON.parse(raw) as Table;
    const doors = staleDoors.generatedFrom?.doors;
    if (!doors || !doors.some((d) => d.startsWith('conformance/MANIFEST.json ('))) {
      console.error('self-test (i) FAILED: generatedFrom.doors carries no conformance/MANIFEST.json entry — the planted red cannot be built');
      process.exit(1);
    }
    const at = doors.findIndex((d) => d.startsWith('conformance/MANIFEST.json ('));
    doors[at] = doors[at].replace(/\(\d+/, '(99999');
    const i1 = verify(JSON.stringify(staleDoors, null, 2) + '\n', realRead);
    if (!i1.some((p) => p.includes('generatedFrom.doors') && p.includes('is stale'))) {
      console.error(`self-test (i) FAILED: a stale doors case count did not refuse. Got:\n  ${i1.join('\n  ')}`);
      process.exit(1);
    }
    // …and the remedy must actually REPAIR it, back to the committed bytes.
    const { moves } = rederive(staleDoors, loadManifests(realRead), reachableChannels());
    if (!moves.some((mv) => mv.includes('generatedFrom.doors'))) {
      console.error(`self-test (i) FAILED: --rederive did not NAME the doors repair it made. Got:\n  ${moves.join('\n  ')}`);
      process.exit(1);
    }
    if (JSON.stringify(staleDoors.generatedFrom?.doors) !== JSON.stringify((JSON.parse(raw) as Table).generatedFrom?.doors)) {
      console.error('self-test (i) FAILED: --rederive did not restore generatedFrom.doors to the committed bytes');
      process.exit(1);
    }
  }
  // (j) a doors entry that NAMES a manifest but quotes no parseable count —
  //     the derivation must REFUSE BY NAME rather than shrug and pass, which
  //     is the half of this defect that let it hide.
  {
    const shapeless = JSON.parse(raw) as Table;
    const doors = shapeless.generatedFrom!.doors!;
    const at = doors.findIndex((d) => d.startsWith('conformance/MANIFEST.json ('));
    doors[at] = 'conformance/MANIFEST.json (the css-dom kit)';
    const j = verify(JSON.stringify(shapeless, null, 2) + '\n', realRead);
    if (!j.some((p) => p.includes('quotes no case count'))) {
      console.error(`self-test (j) FAILED: a doors entry naming a manifest with no derivable count did not refuse. Got:\n  ${j.join('\n  ')}`);
      process.exit(1);
    }
  }
  // (h) --rederive must REPAIR exactly what the gate refuses, byte-for-byte.
  //     Only `evidence` is scrambled: it is the fully derived field, the
  //     analogue of the door register scrambling every ordinary `ruleLine`.
  //     `conformance` is deliberately left alone because its canvas half is
  //     HAND-declared and a derivation that could reinvent it would be
  //     claiming to know something it cannot.
  const scrambled = JSON.parse(raw) as Table;
  let scrambledCount = 0;
  for (const r of scrambled.properties) {
    if (r.class !== 'CARRIED') continue;
    r.evidence = r.evidence === 'unobservable' ? 'measured' : 'unobservable';
    scrambledCount++;
  }
  if (scrambledCount === 0) {
    console.error('self-test (h) FAILED: no CARRIED row to scramble — the planted red cannot be built');
    process.exit(1);
  }
  const { moves } = rederive(scrambled, loadManifests(realRead), reachableChannels());
  if (JSON.stringify(scrambled, null, 2) + '\n' !== raw) {
    console.error(`self-test (h) FAILED: --rederive did not restore ${scrambledCount} scrambled evidence field(s) to the committed bytes`);
    process.exit(1);
  }
  if (moves.length !== scrambledCount) {
    console.error(`self-test (h) FAILED: --rederive reported ${moves.length} move(s) for ${scrambledCount} scrambled field(s) — it must name every repair it makes`);
    process.exit(1);
  }
  console.log(
    '✔ channel-table self-test: a dropped observed row, a ghost CARRIED anchor, a non-canonical byte, a CARRIED row with no evidence state, a "measured" over-claim, a ghost case cite, a cite that measures another channel, a STALE generatedFrom.doors case count and a doors entry that names a manifest without a derivable count each go red by name — and --rederive restores both the scrambled evidence fields and the doors counts byte-for-byte',
  );
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
const ev: Record<string, number> = { measured: 0, 'code-cited': 0, unobservable: 0 };
for (const r of t.properties) if (r.class === 'CARRIED' && r.evidence) ev[r.evidence]++;
console.log(
  `✔ channel table closed: ${t.properties.length} properties (${t.totals.CARRIED} carried · ${t.totals.LEDGERED} ledgered · ${t.totals.REFUSED} refused · ${t.totals.INERT} inert) cover the ${observed.size} observed by ${artifacts} committed capture artifact(s); every schema/conformance channel has a row; every CARRIED anchor exists; bytes canonical`,
);
console.log(
  `  CARRIED evidence: ${ev.measured} MEASURED by a named case · ${ev['code-cited']} code-cited only (a declared gap) · ${ev.unobservable} unobservable (no contract can spell the channel, so no case could ever catch it)`,
);
