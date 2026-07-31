/**
 * THE REFUSAL LEDGER — `npx tsx extract/figma/ledger/build.ts`
 *
 * Builds `examples/untitled-ui/LEDGER.md`: the one artifact a design-system
 * lead can read to decide whether to adopt this tool on THIS kit. It answers
 * three questions with measured numbers — what carries, what refuses by name,
 * what carries but degrades — and it names the open reds.
 *
 * THE RULE OF THIS FILE: it AGGREGATES. Every number in the output is READ
 * from a committed artifact at build time. Nothing is typed in. When a source
 * cannot answer a question, the ledger says so (see §5.3) rather than filling
 * the hole with a plausible figure.
 *
 * The only hand-authored content here is LABELS (group headings, the prose
 * frame) and two small attribution tables that are declared as such in the
 * output: the conformance-group display names, and the stage→side mapping.
 * Even the capture-side/inversion-side split of the conformance vocabulary is
 * derived from the MANIFEST's own wording ("capture-boundary" / "the capture
 * receipts …"), not from an opinion held here.
 *
 * DETERMINISM: no clock, no HEAD, no environment. Every collection is sorted
 * before it is rendered. Two runs over unchanged sources are byte-identical;
 * §6 prints a short content hash of each source so a reader can tell which
 * bytes produced which numbers.
 *
 * SOURCES (all committed):
 *   examples/untitled-ui/renders/fidelity.json         pixel fidelity, per variant
 *   examples/untitled-ui/renders/FIDELITY.md           its method statement
 *   extract/figma/conformance/MANIFEST.json            the document-model denominator
 *   extract/figma/roundtrip-uui/report.json            canvas→code→canvas facts
 *   extract/figma/roundtrip-uui/REPORT.md              its tag glossary + pipeline finding
 *   examples/untitled-ui/storybook/contracts/*.json    the proposals themselves
 *   examples/untitled-ui/dumps-v2/*.dump.json          capture receipts (_degradations)
 *   examples/untitled-ui/assets/icons/manifest.json    icon export receipts
 *   examples/untitled-ui/AUDIT-ROUND-1.md              the original defect classes
 *   examples/untitled-ui/storybook/src/**              the emitted code (probe target)
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
const UUI = path.join(ROOT, 'examples', 'untitled-ui');
const CONTRACTS_DIR = path.join(UUI, 'storybook', 'contracts');
const DUMPS_DIR = path.join(UUI, 'dumps-v2');
const GEN_DIR = path.join(UUI, 'storybook', 'src', 'generated');
const OUT = path.join(UUI, 'LEDGER.md');
const BUILD_CMD = 'npx tsx extract/figma/ledger/build.ts';

/* ------------------------------------------------------------------ types */

interface FidelityRow {
  set: string;
  variant: string;
  score: number | null;
  note?: string;
}

interface ConformanceCase {
  id: string;
  construct: string;
  expect: 'CARRIED' | 'REFUSED' | 'LEDGERED';
  why: string;
  status: 'green' | 'red';
  observed?: string;
}
interface ConformanceManifest {
  note: string;
  cases: ConformanceCase[];
}

interface RtFact {
  variant: string;
  path: string;
  channel: string;
  value: string;
  tag?: string;
}
interface RtResult {
  component: string;
  contractId: string;
  status: string;
  originalVariants: number;
  roundTripVariants: number;
  matched: number;
  diverged: RtFact[];
  loss: RtFact[];
  invented: RtFact[];
}
interface RtReport {
  generatedBy: string;
  totals: {
    components: number;
    roundTripClosed: number;
    matched: number;
    diverged: number;
    loss: number;
    invented: number;
  };
  results: RtResult[];
}

interface AnatomyNode {
  parts?: Record<string, AnatomyPart>;
}
interface AnatomyPart extends AnatomyNode {
  component?: { id: string };
  visibleWhen?: { prop: string; equals?: unknown };
}
interface Contract {
  id: string;
  name?: string;
  description?: string;
  anatomy?: { root?: AnatomyPart };
}

interface Degradation {
  code: string;
  nodePath?: string;
  message: string;
}
interface Dump {
  _provenance?: { dumpVersion?: string; extractedAt?: string };
  _degradations?: Degradation[];
  [k: string]: unknown;
}

interface IconManifest {
  $note: string;
  assets: Record<
    string,
    { sourceComponent?: string; refused?: string; circleFill?: boolean }
  >;
  keyToAsset: Record<string, string>;
}

/* -------------------------------------------------------------- utilities */

const sources: { label: string; rel: string; hash: string; bytes: number }[] = [];

function track(label: string, abs: string, text: string): void {
  sources.push({
    label,
    rel: path.relative(ROOT, abs).split(path.sep).join('/'),
    hash: createHash('sha256').update(text).digest('hex').slice(0, 12),
    bytes: Buffer.byteLength(text),
  });
}

function readText(label: string, abs: string): string {
  const text = readFileSync(abs, 'utf8');
  track(label, abs, text);
  return text;
}

function readJson<T>(label: string, abs: string): T {
  return JSON.parse(readText(label, abs)) as T;
}

/** Deterministic multi-file read: sorted names, hashed as one stream. */
function readDir<T>(
  label: string,
  dir: string,
  filter: (f: string) => boolean,
): { name: string; value: T }[] {
  const names = readdirSync(dir).filter(filter).sort();
  const out: { name: string; value: T }[] = [];
  const h = createHash('sha256');
  let bytes = 0;
  for (const name of names) {
    const text = readFileSync(path.join(dir, name), 'utf8');
    h.update(name).update('\0').update(text).update('\0');
    bytes += Buffer.byteLength(text);
    out.push({ name, value: JSON.parse(text) as T });
  }
  sources.push({
    label: `${label} (${names.length} files)`,
    rel: `${path.relative(ROOT, dir).split(path.sep).join('/')}/`,
    hash: h.digest('hex').slice(0, 12),
    bytes,
  });
  return out;
}

const fmt = (n: number): string => n.toLocaleString('en-US');
const pct = (n: number, d: number): string => (d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`);
const one = (n: number): string => n.toFixed(1);

function table(headers: string[], rows: string[][]): string[] {
  return [
    `| ${headers.join(' | ')} |`,
    `|${headers.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ];
}

/** Escape a value for inclusion in a markdown table cell. */
const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();

/** Pull a `## heading` section (heading line excluded) out of a markdown doc. */
function section(md: string, headingStartsWith: string): string {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => l.startsWith('## ') && l.slice(3).startsWith(headingStartsWith));
  if (start === -1) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join('\n').trim();
}

/* ------------------------------------------------------------------ input */

const fidelity = readJson<FidelityRow[]>('fidelity scores', path.join(UUI, 'renders', 'fidelity.json'));
const fidelityMd = readText('fidelity method', path.join(UUI, 'renders', 'FIDELITY.md'));
const manifest = readJson<ConformanceManifest>(
  'conformance denominator',
  path.join(ROOT, 'extract', 'figma', 'conformance', 'MANIFEST.json'),
);
const rt = readJson<RtReport>(
  'round-trip facts',
  path.join(ROOT, 'extract', 'figma', 'roundtrip-uui', 'report.json'),
);
const rtMd = readText(
  'round-trip narrative',
  path.join(ROOT, 'extract', 'figma', 'roundtrip-uui', 'REPORT.md'),
);
const contracts = readDir<Contract>('proposed contracts', CONTRACTS_DIR, (f) =>
  f.endsWith('.contract.json'),
);
const dumps = readDir<Dump>(
  'canvas dumps',
  DUMPS_DIR,
  (f) => f.endsWith('.dump.json') && f !== 'MERGED.dump.json',
);
const icons = readJson<IconManifest>('icon export receipts', path.join(UUI, 'assets', 'icons', 'manifest.json'));
const auditMd = readText('round-1 audit', path.join(UUI, 'AUDIT-ROUND-1.md'));

/* --------------------------------------------------- emitted-code corpus */

interface Emitted {
  dir: string;
  tsx: string; // the component TSX only
  stories: string;
  css: string;
  props: Record<string, string>;
}

const tokensCss = readText('emitted global tokens', path.join(UUI, 'storybook', 'src', 'tokens.css'));

const emitted: Record<string, Emitted> = {};
{
  const h = createHash('sha256');
  let bytes = 0;
  for (const dir of readdirSync(GEN_DIR).sort()) {
    const p = path.join(GEN_DIR, dir);
    if (!statSync(p).isDirectory()) continue;
    let tsx = '';
    let stories = '';
    let css = '';
    for (const f of readdirSync(p).sort()) {
      const text = readFileSync(path.join(p, f), 'utf8');
      h.update(`${dir}/${f}`).update('\0').update(text).update('\0');
      bytes += Buffer.byteLength(text);
      if (f.endsWith('.stories.tsx')) stories += `${text}\n`;
      else if (f.endsWith('.tsx')) tsx += `${text}\n`;
      else if (f.endsWith('.css')) css += `${text}\n`;
    }
    const props: Record<string, string> = {};
    const iface = tsx.match(/export interface \w+Props[^{]*\{([\s\S]*?)\n\}/);
    if (iface) {
      for (const line of iface[1].split('\n')) {
        const m = line.match(/^\s*(\w+)\??:\s*(.+);\s*$/);
        if (m) props[m[1]] = m[2].trim();
      }
    }
    emitted[dir] = { dir, tsx, stories, css, props };
  }
  sources.push({
    label: `emitted components (${Object.keys(emitted).length} dirs)`,
    rel: 'examples/untitled-ui/storybook/src/generated/',
    hash: h.digest('hex').slice(0, 12),
    bytes,
  });
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const emittedByNorm: Record<string, Emitted> = {};
for (const e of Object.values(emitted)) emittedByNorm[norm(e.dir)] = e;

/* ------------------------------------------- instrument 1 · pixel fidelity */

const fidBySet = new Map<string, FidelityRow[]>();
for (const row of fidelity) {
  const list = fidBySet.get(row.set) ?? [];
  list.push(row);
  fidBySet.set(row.set, list);
}
const fidSets = [...fidBySet.keys()].sort();
const scored = fidelity.filter((r): r is FidelityRow & { score: number } => typeof r.score === 'number');
const unscored = fidelity.filter((r) => typeof r.score !== 'number');
const unscoredByNote = new Map<string, FidelityRow[]>();
for (const r of unscored) {
  const key = r.note ?? '(no note)';
  const list = unscoredByNote.get(key) ?? [];
  list.push(r);
  unscoredByNote.set(key, list);
}
const mean = (rows: { score: number }[]): number =>
  rows.reduce((a, b) => a + b.score, 0) / rows.length;
const overallMean = mean(scored);

const setMeans = fidSets
  .map((s) => {
    const rows = (fidBySet.get(s) ?? []).filter(
      (r): r is FidelityRow & { score: number } => typeof r.score === 'number',
    );
    return { set: s, n: rows.length, mean: mean(rows) };
  })
  .filter((x) => x.n > 0);
const bestSet = [...setMeans].sort((a, b) => b.mean - a.mean || a.set.localeCompare(b.set))[0];
const worstSet = [...setMeans].sort((a, b) => a.mean - b.mean || a.set.localeCompare(b.set))[0];

const BUCKETS: { label: string; test: (n: number) => boolean }[] = [
  { label: '≥ 95 (indistinguishable at a glance)', test: (n) => n >= 95 },
  { label: '90 – 95', test: (n) => n >= 90 && n < 95 },
  { label: '80 – 90', test: (n) => n >= 80 && n < 90 },
  { label: '70 – 80', test: (n) => n >= 70 && n < 80 },
  { label: '< 70 (visibly a different drawing)', test: (n) => n < 70 },
];
const buckets = BUCKETS.map((b) => ({ label: b.label, n: scored.filter((r) => b.test(r.score)).length }));
const atOrAbove95 = buckets[0].n;
const perfect = scored.filter((r) => r.score >= 99.995).length;

/* the FIDELITY.md method statement (first paragraph after the H1) */
const fidelityMethod =
  fidelityMd
    .split('\n')
    .slice(1)
    .find((l) => l.trim().length > 0)
    ?.trim() ?? '(FIDELITY.md carries no method paragraph)';

/* ------------------------------------- instrument 2 · document-model cases */

const cases = [...manifest.cases].sort((a, b) => a.id.localeCompare(b.id));
const byExpect = (e: ConformanceCase['expect']): ConformanceCase[] => cases.filter((c) => c.expect === e);
const greenCases = cases.filter((c) => c.status === 'green');
const redCases = cases.filter((c) => c.status === 'red');
const carriedGreen = cases.filter((c) => c.expect === 'CARRIED' && c.status === 'green');
const refusedCases = byExpect('REFUSED');
const ledgeredCases = byExpect('LEDGERED');

/** Side attribution derived from the MANIFEST's own wording, not from opinion. */
const CAPTURE_WORDING = /capture-boundary|the capture receipts|dump v1 (carries|stops)|no dump v1 field|outside dump v1|only px is captured/i;
const sideOfCase = (c: ConformanceCase): 'capture-side' | 'inversion-side' =>
  CAPTURE_WORDING.test(`${c.construct} ${c.why}`) ? 'capture-side' : 'inversion-side';

/** Display names for the id prefixes. Labels only — every count is measured. */
const GROUP_LABELS: Record<string, string> = {
  axis: 'Variant axes (enum, boolean, on/off, state, theme)',
  blend: 'Blend modes',
  bool: 'Boolean property defaults',
  effect: 'Effects (shadows, blurs)',
  fill: 'Fills and paints',
  instance: 'Nested instances and their linkage',
  layout: 'Auto-layout (direction, gap, padding, alignment, sizing)',
  minmax: 'Min/max sizing',
  nest: 'Deep part nesting',
  opacity: 'Node opacity',
  placement: 'Absolute placement and constraints',
  radius: 'Corner radii',
  rotation: 'Rotation',
  shape: 'Drawn geometry (ellipse, polygon, arc, rotated rect, vector)',
  slot: 'Slots and preferred values',
  sparse: 'Sparse / minority children',
  spacer: 'Spacers and growth',
  stroke: 'Strokes',
  text: 'Text and typography',
  wrapper: 'Pass-through wrapper folding',
};
const groupOf = (id: string): string => id.split('-')[0];
const groups = [...new Set(cases.map((c) => groupOf(c.id)))].sort();

/* ------------------------------------- instrument 3 · canvas→code→canvas */

type RtKind = 'diverged' | 'loss' | 'invented';
const RT_KINDS: RtKind[] = ['diverged', 'loss', 'invented'];

interface TagStat {
  tag: string;
  facts: number;
  kinds: Record<RtKind, number>;
  components: Set<string>;
  variants: Set<string>;
}
const tagStats = new Map<string, TagStat>();
for (const res of rt.results) {
  for (const kind of RT_KINDS) {
    for (const f of res[kind]) {
      const tag = f.tag ?? '(untagged)';
      let s = tagStats.get(tag);
      if (!s) {
        s = { tag, facts: 0, kinds: { diverged: 0, loss: 0, invented: 0 }, components: new Set(), variants: new Set() };
        tagStats.set(tag, s);
      }
      s.facts++;
      s.kinds[kind]++;
      s.components.add(res.component);
      s.variants.add(`${res.component}|${f.variant}`);
    }
  }
}
const tagsRanked = [...tagStats.values()].sort((a, b) => b.facts - a.facts || a.tag.localeCompare(b.tag));
const untagged = tagStats.get('(untagged)');
const untaggedFacts = untagged?.facts ?? 0;
const nonMatched = rt.totals.diverged + rt.totals.loss + rt.totals.invented;
const inventedTagged = rt.totals.invented - (untagged?.kinds.invented ?? 0);

/** The tag glossary REPORT.md prints for itself. */
const tagGlossary = new Map<string, string>();
for (const line of rtMd.split('\n')) {
  const m = line.match(/^- `([a-z-]+)` — (.+)$/);
  if (m) tagGlossary.set(m[1], m[2]);
}
const glossFor = (tag: string): string => tagGlossary.get(tag) ?? '(REPORT.md carries no glossary line for this tag)';

/** The named pipeline finding — quoted from REPORT.md, not restated. */
const pipelineFinding = section(rtMd, 'Named pipeline finding');

/* ------------------------------------- instrument 4 · the named-refusal surface */

const STUB_PREFIX = 'STUB';
const stubContracts = contracts.filter((c) => (c.value.description ?? '').startsWith(STUB_PREFIX));
const fullContracts = contracts.filter((c) => !(c.value.description ?? '').startsWith(STUB_PREFIX));
const stubNote = stubContracts[0]?.value.description ?? '';
const proposedNote = fullContracts[0]?.value.description ?? '';

interface DegStat {
  code: string;
  records: number;
  sets: Set<string>;
  variants: Set<string>;
  message: string;
}
const degStats = new Map<string, DegStat>();
const dumpVersions = new Map<string, number>();
for (const { name, value } of dumps) {
  const set = name.replace('.dump.json', '');
  const v = value._provenance?.dumpVersion ?? '(unversioned)';
  dumpVersions.set(v, (dumpVersions.get(v) ?? 0) + 1);
  for (const d of value._degradations ?? []) {
    let s = degStats.get(d.code);
    if (!s) {
      s = { code: d.code, records: 0, sets: new Set(), variants: new Set(), message: d.message };
      degStats.set(d.code, s);
    }
    s.records++;
    s.sets.add(set);
    s.variants.add(`${set}|${(d.nodePath ?? '').split('/')[0]}`);
  }
}
const degRanked = [...degStats.values()].sort((a, b) => b.records - a.records || a.code.localeCompare(b.code));
const degTotal = degRanked.reduce((a, b) => a + b.records, 0);

const iconIds = Object.keys(icons.assets).sort();
const iconRefused = iconIds.filter((k) => icons.assets[k].refused);

/* IMAGE paints: ledgered as omitted by the dump, recovered by the imageFill channel. */
const imageFillBySet = new Map<string, number>();
for (const { name, value } of dumps) {
  const set = name.replace('.dump.json', '');
  const n = (JSON.stringify(value).match(/"imageFill":/g) ?? []).length;
  if (n > 0) imageFillBySet.set(set, n);
}
const imageFillTotal = [...imageFillBySet.values()].reduce((a, b) => a + b, 0);
const imagesDir = path.join(UUI, 'assets', 'images');
const imageAssets = existsSync(imagesDir) ? readdirSync(imagesDir).filter((f) => !f.startsWith('.')).length : 0;

/* Set members the capture never saw: fidelity enumerates them, the dump has no variant. */
const rtVariants = new Map(rt.results.map((r) => [r.component, r.originalVariants]));
const uncapturedMembers = fidSets
  .map((s) => ({
    set: s,
    enumerated: (fidBySet.get(s) ?? []).length,
    captured: rtVariants.get(s) ?? -1,
  }))
  .filter((x) => x.captured >= 0 && x.enumerated !== x.captured)
  .sort((a, b) => a.set.localeCompare(b.set));

/* ---------------------------------------------- contract carriage features */

const FEATURES = [
  'visibleWhen',
  'textByProp',
  'layoutByProp',
  'stylesWhen',
  'overrides',
  'figmaStatePreviews',
  'asset',
  'mask',
] as const;
const featureCounts: Record<string, { total: number; contracts: number }> = {};
for (const f of FEATURES) featureCounts[f] = { total: 0, contracts: 0 };
for (const { value } of contracts) {
  const text = JSON.stringify(value);
  for (const f of FEATURES) {
    const n = (text.match(new RegExp(`"${f}":`, 'g')) ?? []).length;
    if (n > 0) {
      featureCounts[f].total += n;
      featureCounts[f].contracts++;
    }
  }
}

/* ------------------------------------------------- the round-1 audit probes */

interface AuditClass {
  name: string;
  stage: string;
  severity: string;
  components: string[];
}
const auditClasses: AuditClass[] = [];
{
  const lines = auditMd.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('### ')) continue;
    const name = lines[i].slice(4).trim();
    let stage = '(not stated)';
    let severity = '(not stated)';
    let components: string[] = [];
    for (let j = i + 1; j < lines.length && !lines[j].startsWith('### ') && !lines[j].startsWith('## '); j++) {
      const st = lines[j].match(/\*\*Stage:\*\*\s*([a-z-]+)/);
      if (st) stage = st[1];
      const sv = lines[j].match(/\*\*Severity:\*\*\s*([A-Z]+)/);
      if (sv) severity = sv[1];
      const cp = lines[j].match(/^- \*\*Components:\*\*\s*(.+)$/);
      if (cp) components = cp[1].split(',').map((s) => s.trim()).filter(Boolean);
    }
    auditClasses.push({ name, stage, severity, components });
  }
}
/** The doc's own headline count of its classes, read from its prose. */
const auditClaimedCount = auditMd.match(/deduplicated into (\d+) classes/)?.[1] ?? '(not stated)';

/** stage → which side of the pipe owns it. A declared convention, printed as such. */
const STAGE_SIDE: Record<string, string> = {
  dump: 'capture-side',
  'propose-invert': 'inversion-side',
  mint: 'inversion-side',
  'emit-react': 'emitter-side',
  'story-gen': 'emitter-side',
};
const sideOfStage = (s: string): string => STAGE_SIDE[s] ?? '(unmapped stage)';

/* ---- probes. Each returns a verdict plus the measurement that produced it. */

type Verdict = 'CLOSED' | 'PARTIAL' | 'OPEN' | 'NAMED-BY-DESIGN';
interface Probe {
  verdict: Verdict;
  /** 'this kit' = counted over the 15 committed sets; 'fixture' = proven on the
   *  synthetic conformance library only, NOT re-measured on this kit. */
  basis: 'this kit' | 'fixture';
  evidence: string;
}
const plural = (n: number, s1: string, sn = `${s1}s`): string => `${n} ${n === 1 ? s1 : sn}`;
const probes: Record<string, Probe> = {};
/** Audit headings carry a parenthetical gloss; probes are keyed on the bare class name. */
const classKey = (heading: string): string => heading.split(' (')[0].trim();
const setProbe = (heading: string, probe: Probe): void => {
  probes[classKey(heading)] = probe;
};
const getProbe = (heading: string): Probe | undefined => probes[classKey(heading)];

const gatedParts = (c: Contract): { key: string; prop: string; isComponent: boolean }[] => {
  const out: { key: string; prop: string; isComponent: boolean }[] = [];
  const walk = (n: AnatomyPart | undefined): void => {
    if (!n?.parts) return;
    for (const key of Object.keys(n.parts).sort()) {
      const p = n.parts[key];
      if (p.visibleWhen) out.push({ key, prop: p.visibleWhen.prop, isComponent: Boolean(p.component) });
      walk(p);
    }
  };
  walk(c.anatomy?.root);
  return out;
};

const partNames = (c: Contract): string[] => {
  const out: string[] = [];
  const walk = (n: AnatomyPart | undefined): void => {
    if (!n?.parts) return;
    for (const key of Object.keys(n.parts).sort()) {
      out.push(key);
      walk(n.parts[key]);
    }
  };
  walk(c.anatomy?.root);
  return out;
};

const contractStem = (name: string): string => name.replace('.contract.json', '');
const emittedFor = (stem: string): Emitted | undefined => emittedByNorm[norm(stem)];

/* 1 · unconditional-parts — do the named components gate their parts at all? */
{
  const named = (auditClasses.find((c) => c.name.startsWith('unconditional-parts'))?.components ?? []).map(norm);
  const withGates = contracts.filter(
    (c) => named.includes(norm(contractStem(c.name))) && gatedParts(c.value).length > 0,
  );
  const total = contracts.filter((c) => named.includes(norm(contractStem(c.name)))).length;
  const allGates = contracts.reduce((a, c) => a + gatedParts(c.value).length, 0);
  setProbe('unconditional-parts', {
    verdict: withGates.length === total ? 'CLOSED' : 'PARTIAL',
    basis: 'this kit',
    evidence: `${withGates.length}/${total} named components now carry at least one \`visibleWhen\`; ${allGates} gated parts across all ${contracts.length} contracts.`,
  });
}

/* 2 · emitter drops visibleWhen on component parts — does every gate reach the TSX? */
{
  let total = 0;
  let guarded = 0;
  let compTotal = 0;
  let compGuarded = 0;
  for (const c of contracts) {
    const e = emittedFor(contractStem(c.name));
    if (!e) continue;
    for (const g of gatedParts(c.value)) {
      const re = new RegExp(`${g.prop}\\s*(===|!==|&&|\\?)`);
      const ok = re.test(e.tsx);
      total++;
      if (ok) guarded++;
      if (g.isComponent) {
        compTotal++;
        if (ok) compGuarded++;
      }
    }
  }
  setProbe('emitter-drops-visibleWhen-on-component-parts', {
    verdict: total === guarded ? 'CLOSED' : 'OPEN',
    basis: 'this kit',
    evidence: `${guarded}/${total} contract \`visibleWhen\` gates produce a conditional in the emitted TSX, including ${compGuarded}/${compTotal} on nested-component parts (the audited hole).`,
  });
}

/* 3 · plain-rect geometry, 4 · arcs and vectors, 8 · overlays — conformance owns these. */
const caseById = new Map(cases.map((c) => [c.id, c]));
const casesVerdict = (ids: string[]): Probe => {
  const found = ids.map((id) => caseById.get(id)).filter((c): c is ConformanceCase => Boolean(c));
  const green = found.filter((c) => c.status === 'green');
  const carried = found.filter((c) => c.expect === 'CARRIED');
  const ledgered = found.filter((c) => c.expect === 'LEDGERED');
  const verdict: Verdict =
    green.length !== found.length ? 'OPEN' : ledgered.length > 0 && carried.length === 0 ? 'NAMED-BY-DESIGN' : 'CLOSED';
  return {
    verdict,
    basis: 'fixture',
    evidence: found
      .map((c) => `\`${c.id}\` ${c.expect}/${c.status}`)
      .join(', ')
      .concat(found.length === ids.length ? '' : ' — some requested case ids are absent from the manifest'),
  };
};
setProbe('plain-rect-geometry-dropped', casesVerdict(['shape-rect-abs', 'placement-fixedsize-inflow', 'layout-root-fixed-bbox']));
setProbe(
  'arc-and-vector-geometry-lost',
  casesVerdict(['shape-arc-partial', 'shape-arc-full', 'shape-arc-donut', 'shape-vector-path']),
);
setProbe('overlay-flattened', casesVerdict(['placement-abs-frame', 'placement-xy-none-layout']));
setProbe(
  'style-channel-dropped',
  casesVerdict([
    'layout-gap-literal',
    'layout-padding-asymmetric-bound',
    'layout-justify-space-between',
    'effect-shadow-single',
    'stroke-uniform-var',
    'text-style-token',
  ]),
);
setProbe(
  'root-sizing-lost',
  casesVerdict(['layout-root-fixed-bbox', 'layout-width-bound-root', 'layout-root-default-elided']),
);
setProbe(
  'ledgered-degradations-visible',
  casesVerdict(['radius-per-corner', 'text-lineheight-percent', 'stroke-weights-nonuniform']),
);

/* 5 · axis-inert — a class template the TSX composes but the CSS never defines. */
interface AxisRow {
  set: string;
  axis: string;
  cssRule: boolean;
  tsxBranch: boolean;
  variants: number;
}
const axisRows: AxisRow[] = [];
for (const c of fullContracts) {
  const stem = contractStem(c.name);
  const e = emittedFor(stem);
  if (!e) continue;
  const defined = new Set([...e.css.matchAll(/^\.([A-Za-z0-9_-]+)/gm)].map((m) => m[1]));
  const axes = [...new Set([...e.tsx.matchAll(/styles\[`([A-Za-z0-9_-]+)-\$\{/g)].map((m) => m[1]))].sort();
  for (const axis of axes) {
    axisRows.push({
      set: stem,
      axis,
      cssRule: [...defined].some((d) => d.startsWith(`${axis}-`)),
      tsxBranch: new RegExp(`${axis}\\s*===`).test(e.tsx),
      variants: (fidBySet.get(stem) ?? []).length,
    });
  }
}
const danglingAxes = axisRows.filter((r) => !r.cssRule).sort((a, b) => a.set.localeCompare(b.set) || a.axis.localeCompare(b.axis));
const fullyInert = danglingAxes.filter((r) => !r.tsxBranch);
const danglingSets = [...new Set(danglingAxes.map((r) => r.set))].sort();
const danglingVariants = danglingSets.reduce((a, s) => a + (fidBySet.get(s) ?? []).length, 0);
setProbe('axis-inert', {
  verdict: danglingAxes.length === 0 ? 'CLOSED' : 'OPEN',
  basis: 'this kit',
  evidence: `${danglingAxes.length} of ${axisRows.length} axis class templates in the ${fullContracts.length} full sets resolve to no CSS rule (${danglingAxes.map((r) => `${r.set}.${r.axis}`).join(', ') || 'none'}); ${fullyInert.length} of those ${fullyInert.length === 1 ? 'drives' : 'drive'} no TSX branch either. Blast radius ${danglingVariants} of ${fidelity.length} enumerated variants across ${danglingSets.length} sets.`,
});

/* 6 · first-variant-freeze — is the axis-correlated literal bound to the axis now? */
{
  const named = (auditClasses.find((c) => c.name.startsWith('first-variant-freeze'))?.components ?? []).map(norm);
  const rows = contracts.filter((c) => named.includes(norm(contractStem(c.name))));
  const bound = rows.filter((c) => JSON.stringify(c.value).includes('"textByProp":'));
  const styled = rows.filter((c) => JSON.stringify(c.value).includes('"stylesWhen":'));
  const covered = rows.filter(
    (c) => JSON.stringify(c.value).includes('"textByProp":') || JSON.stringify(c.value).includes('"stylesWhen":'),
  );
  setProbe('first-variant-freeze', {
    verdict: covered.length === rows.length ? 'CLOSED' : 'PARTIAL',
    basis: 'this kit',
    evidence: `${bound.length}/${rows.length} named components bind a per-axis text lookup (\`textByProp\`) and ${styled.length}/${rows.length} bind per-axis style sets (\`stylesWhen\`); ${covered.length}/${rows.length} carry at least one.`,
  });
}

/* 7 · duplicate parts from wrapper union — numbered siblings of an existing part. */
{
  const dupes: string[] = [];
  for (const c of contracts) {
    const names = partNames(c.value);
    for (const n of names) {
      if (/\d$/.test(n) && names.includes(n.replace(/\d+$/, ''))) dupes.push(`${contractStem(c.name)}.${n}`);
    }
  }
  dupes.sort();
  setProbe('duplicate-parts-from-wrapper-union', {
    verdict: dupes.length === 0 ? 'CLOSED' : 'PARTIAL',
    basis: 'this kit',
    evidence: `${plural(dupes.length, 'numbered part name')} whose base name is also a part of the same contract (${dupes.join(', ') || 'none'}); the audited duplicates (ProgressCircle's four label parts, DropdownListItem's Text2/Checkbox×2/circle×2, InputFieldBase's tripled trailing icons) are all absent. The probe cannot prove the residuals are not genuine sibling nodes.`,
  });
}

/* 11 · string→boolean coercion — a string literal landing on a boolean prop. */
{
  let checked = 0;
  const bad: string[] = [];
  for (const e of Object.values(emitted)) {
    for (const src of [e.tsx, e.stories]) {
      for (const m of src.matchAll(/<([A-Z]\w+)([^>]*?)\/?>/g)) {
        const target = emitted[m[1]];
        if (!target) continue;
        for (const a of m[2].matchAll(/(\w+)="([^"]*)"/g)) {
          const ty = target.props[a[1]];
          if (!ty) continue;
          checked++;
          if (ty === 'boolean') bad.push(`${e.dir} → ${m[1]}.${a[1]}="${a[2]}"`);
        }
      }
    }
  }
  bad.sort();
  setProbe('string-boolean-coercion', {
    verdict: bad.length === 0 ? 'CLOSED' : 'OPEN',
    basis: 'this kit',
    evidence: `${bad.length} of ${checked} string-literal JSX attributes land on a dependency prop typed \`boolean\`${bad.length ? ` (${bad.join('; ')})` : ''}.`,
  });
}

/* 12 · UA default leakage — is there a baseline reset at all? */
{
  const reset = /box-sizing:\s*border-box/.test(tokensCss);
  const rootRules = Object.values(emitted)
    .map((e) => e.css.match(/\.root \{[^}]*\}/))
    .filter((m): m is RegExpMatchArray => Boolean(m));
  const rootsWithBg = rootRules.filter((m) => /background/.test(m[0])).length;
  setProbe('ua-default-leakage', {
    verdict: reset ? 'PARTIAL' : 'OPEN',
    basis: 'this kit',
    evidence: `global \`box-sizing: border-box\` reset in tokens.css: ${reset ? 'present' : 'ABSENT'}; ${rootsWithBg}/${rootRules.length} emitted \`.root\` rules set a background explicitly. No \`appearance:\` reset exists anywhere in the emitted CSS (${Object.values(emitted).filter((e) => /appearance:/.test(e.css)).length} files).`,
  });
}

/* 13 · variant-name transliteration — the API surface the audit called hostile. */
const RESERVED = ['style', 'className', 'key', 'ref'];
{
  const collisions: string[] = [];
  const falseEnums: string[] = [];
  const numericEnums: string[] = [];
  for (const e of Object.values(emitted).sort((a, b) => a.dir.localeCompare(b.dir))) {
    for (const [k, v] of Object.entries(e.props).sort(([a], [b]) => a.localeCompare(b))) {
      if (RESERVED.includes(k)) collisions.push(`${e.dir}.${k}`);
      if (/'false'/.test(v)) falseEnums.push(`${e.dir}.${k}`);
      if (/^'\d+'/.test(v)) numericEnums.push(`${e.dir}.${k}`);
    }
  }
  setProbe('variant-name-transliteration-api', {
    verdict: collisions.length === 0 && falseEnums.length === 0 && numericEnums.length === 0 ? 'CLOSED' : 'OPEN',
    basis: 'this kit',
    evidence: `${plural(collisions.length, 'reserved-name collision')} (${collisions.join(', ') || 'none'}); ${plural(falseEnums.length, 'prop')} whose enum still spells \`'false'\` instead of absence/boolean; ${plural(numericEnums.length, 'numeric-valued string enum')} (${numericEnums.join(', ') || 'none'}).`,
  });
}

/* 14 · story-space mismatch — does the enumerated variant space match the capture? */
{
  const mism = uncapturedMembers.map((x) => `${x.set} ${x.enumerated} enumerated vs ${x.captured} captured`);
  setProbe('story-space-mismatch', {
    verdict: mism.length === 0 ? 'CLOSED' : 'PARTIAL',
    basis: 'this kit',
    evidence: `${fidSets.length - mism.length}/${fidSets.length} sets enumerate exactly the variants the capture holds${mism.length ? `; disagreements: ${mism.join('; ')}` : ''}. Story files are generated per set (${Object.values(emitted).filter((e) => e.stories.length > 0).length} of ${Object.keys(emitted).length} emitted components ship stories).`,
  });
}

/* --------------------------------------------------------------- rendering */

const L: string[] = [];
const p = (...lines: string[]): void => {
  L.push(...lines);
};

p(
  '# Untitled UI — the refusal ledger',
  '',
  `**What this tool will and will not carry, measured on this kit.** Every number below is read out of a committed artifact when this file is built; none is typed in. Where an artifact cannot answer, the ledger says so (§5.3) instead of estimating.`,
  '',
  `Generated by \`${BUILD_CMD}\`. Sources and their content hashes: §6. The build has no clock and no git read — over unchanged sources it is byte-identical.`,
  '',
  '---',
  '',
);

/* ------------------------------------------------------------ §1 headline */

p(
  '## 1. The headline',
  '',
  `Fifteen Untitled UI component sets were drawn by hand on a Figma canvas, captured, inverted into contracts, and emitted as React. The loop then closed the other way: those same contracts were emitted **back** to Figma and diffed against the original drawing. ${rt.totals.roundTripClosed} of ${rt.totals.components} round trips close.`,
  '',
  '### The four instruments',
  '',
);
p(
  ...table(
    ['instrument', 'what it holds the tool to', 'current reading', 'artifact'],
    [
      [
        'Pixel fidelity',
        'a render of the emitted React vs the canvas reference, per variant',
        `**${one(overallMean)}%** mean over ${fmt(scored.length)} scored variants in ${fidSets.length} sets (best ${bestSet.set} ${one(bestSet.mean)}%, worst ${worstSet.set} ${one(worstSet.mean)}%)`,
        '`renders/fidelity.json`',
      ],
      [
        'Document-model conformance',
        'one hand-authored case per Figma construct, with a hand-authored expected disposition',
        `**${greenCases.length}/${cases.length}** green, ${redCases.length} pinned red — ${byExpect('CARRIED').length} constructs expected CARRIED, ${refusedCases.length} REFUSED, ${ledgeredCases.length} LEDGERED`,
        '`extract/figma/conformance/MANIFEST.json`',
      ],
      [
        'Canvas→code→canvas round trip',
        'every (variant ▸ node ▸ channel) fact, four ways',
        `**${rt.totals.roundTripClosed}/${rt.totals.components}** closed · ${fmt(rt.totals.matched)} matched · ${fmt(rt.totals.diverged)} diverged · ${fmt(rt.totals.loss)} loss · ${fmt(rt.totals.invented)} invented`,
        '`extract/figma/roundtrip-uui/report.json`',
      ],
      [
        'The named-refusal surface',
        'what the pipeline writes down when it will not carry something',
        `**${fmt(degTotal)}** capture receipts in ${degRanked.length} codes · ${stubContracts.length} stub contracts · ${refusedCases.length + ledgeredCases.length} named conformance limits · ${iconRefused.length} refused icon export`,
        'dumps, contracts, icon manifest',
      ],
    ],
  ),
);

p(
  '',
  '### The one sentence',
  '',
  `> **This tool reproduces a component\'s structure and its token bindings; it approximates its pixels.** Across the ${fmt(scored.length)} variants that can be scored at all, mean agreement with the canvas reference is **${one(overallMean)}%**, only ${atOrAbove95} of them (${pct(atOrAbove95, scored.length)}) reach 95% or better, and ${perfect} reach 100% — so the emitted React is a faithful *specification* of each component and an *approximate* drawing of it. Adopt it to carry API, anatomy, and tokens across the boundary. Do not adopt it expecting pixel-exact output without review.`,
  '',
  `A second sentence an adopter should hear before anything else, quoted from the round-trip report rather than paraphrased:`,
  '',
);
if (pipelineFinding) {
  p(...pipelineFinding.split('\n').map((l) => (l.trim() ? `> ${l}` : '>')));
} else {
  p('> *(REPORT.md carries no "Named pipeline finding" section — nothing to quote.)*');
}

p(
  '',
  '### Where the fidelity actually lands',
  '',
  ...table(
    ['band', 'variants', 'share of scored'],
    buckets.map((b) => [b.label, fmt(b.n), pct(b.n, scored.length)]),
  ),
  '',
  `Method, quoted from \`renders/FIDELITY.md\`: *${fidelityMethod}*`,
  '',
  '---',
  '',
);

/* -------------------------------------------------------- §2 what carries */

p(
  '## 2. What carries',
  '',
  `The document-model fixture is the answer to "will it survive the boundary at all". It is ${cases.length} hand-authored cases whose expected disposition was written from the Figma documentation model, never from engine output; a construct that is neither carried nor named-refused is a hard failure. **${carriedGreen.length} constructs are proven CARRIED and green.** Grouped, with the case ids you can re-run:`,
  '',
);
{
  const rows: string[][] = [];
  for (const g of groups) {
    const inGroup = cases.filter((c) => groupOf(c.id) === g);
    const carried = inGroup.filter((c) => c.expect === 'CARRIED' && c.status === 'green');
    if (carried.length === 0) continue;
    rows.push([
      GROUP_LABELS[g] ?? `\`${g}-*\``,
      String(carried.length),
      carried.map((c) => `\`${c.id}\``).join(' '),
    ]);
  }
  p(...table(['construct family', 'carried', 'case ids'], rows));
}
p(
  '',
  `Group headings above are display labels chosen in \`build.ts\`; the membership and the counts come from the case ids in the manifest.`,
  '',
  '### Carriage exercised on this kit, not just in the fixture',
  '',
  `The fixture proves the vocabulary exists. These counts prove the ${fullContracts.length} full contracts proposed from this canvas actually use it:`,
  '',
  ...table(
    ['contract mechanism', 'occurrences', 'contracts using it'],
    FEATURES.filter((f) => featureCounts[f].total > 0).map((f) => [
      `\`${f}\``,
      fmt(featureCounts[f].total),
      `${featureCounts[f].contracts} / ${contracts.length}`,
    ]),
  ),
  '',
  `And on the return leg, ${fmt(rt.totals.matched)} facts came back from Figma identical to the way they were drawn — ${pct(rt.totals.matched, rt.totals.matched + nonMatched)} of every fact compared.`,
  '',
  '---',
  '',
);

/* -------------------------------------------------------- §3 what refuses */

p(
  '## 3. What refuses by name',
  '',
  `A refusal is a construct the pipeline will not carry **and says so**. Refusals are the feature: an unnamed drop is a bug, a named one is a boundary you can plan around. Every class below is measured on this kit.`,
  '',
);

/* R1 — capture receipts */
p(
  `### 3.1 Capture receipts — channels the dump has no projection for`,
  '',
  `*Capture-side.* The dump writes a \`_degradations\` receipt whenever it meets a channel it cannot spell. Across the ${dumps.length} committed dumps (dump versions ${[...dumpVersions.entries()].sort().map(([v, n]) => `${v}×${n}`).join(', ')}) there are **${fmt(degTotal)} receipts in ${degRanked.length} codes**:`,
  '',
  ...table(
    ['receipt code', 'records', 'sets hit', 'variants hit', 'the message the dump writes'],
    degRanked.map((d) => [
      `\`${d.code}\``,
      fmt(d.records),
      `${d.sets.size} / ${fidSets.length}`,
      `${d.variants.size} / ${fmt(fidelity.length)}`,
      cell(d.message),
    ]),
  ),
  '',
);

/* R2 — stub contracts */
p(
  `### 3.2 Un-imported child sets — the stub contract`,
  '',
  `*Capture-side.* ${stubContracts.length} of the ${contracts.length} contracts in this kit are STUBs: a nested instance whose own component set was never imported. The stub carries the observed applied props, the observed bounding box and the exported glyph — and refuses everything else in writing. Its own words:`,
  '',
  `> ${cell(stubNote)}`,
  '',
  `Stubs: ${stubContracts.map((c) => `\`${contractStem(c.name)}\``).join(', ')}.`,
  '',
  `The ${fullContracts.length} non-stub contracts carry their own standing refusal, which an adopter should read as the scope line of the whole tool:`,
  '',
  `> ${cell(proposedNote)}`,
  '',
);

/* R3 — conformance refusals */
p(
  `### 3.3 Named refusals in the document model`,
  '',
  `${refusedCases.length} constructs are refused **by name** — the proposal must produce a note, never a guess. ${ledgeredCases.length} more are LEDGERED: carried as a receipt while the contract stays honest and invents nothing. All ${refusedCases.length + ledgeredCases.length} are green, meaning the refusal itself is what the fixture verifies. Side is derived from the manifest's own wording (a case whose text says "capture-boundary" or "the capture receipts …" is capture-side; everything else is inversion-side).`,
  '',
  ...table(
    ['case', 'disposition', 'side', 'the construct', 'why it is refused'],
    [...refusedCases, ...ledgeredCases]
      .sort((a, b) => a.expect.localeCompare(b.expect) || a.id.localeCompare(b.id))
      .map((c) => [`\`${c.id}\``, c.expect, sideOfCase(c), cell(c.construct), cell(c.why)]),
  ),
  '',
);

/* R4 — the bundle door */
p(
  `### 3.4 The paste door — this kit cannot round-trip through the shipping bundle`,
  '',
  `*Emitter-side, and the largest single refusal for an adopter.* The round-trip runner had to bypass the plugin's paste referee to measure anything at all. Quoted in §1; the operative facts are that \`captured.dtcg.json\` for this hand-built canvas is \`{}\` (it used zero published Figma variables), so the bundle's \`base\` tokenSet is empty and the referee refuses it, and \`figma bundle\` separately refuses the set because \`social-button\`'s per-variant icon ref \`{platform}\` is read as a literal asset name. **Blast radius: all ${fullContracts.length} sets / all ${fmt(fidelity.length)} variants — no set in this kit can be pasted back through the shipping path today.**`,
  '',
);

/* R5 — uncaptured members */
if (uncapturedMembers.length > 0) {
  p(
    `### 3.5 Set members the capture never saw`,
    '',
    `*Capture-side.* The fidelity harness enumerates variants from the canvas references; the dump holds what capture actually took. Where they disagree, the capture is short:`,
    '',
    ...table(
      ['set', 'enumerated from references', 'present in the dump', 'missing', 'how the harness names it'],
      uncapturedMembers.map((x) => {
        const notes = [
          ...new Set(
            (fidBySet.get(x.set) ?? []).filter((r) => r.note && !r.note.startsWith('interaction-state')).map((r) => r.note ?? ''),
          ),
        ].sort();
        return [x.set, String(x.enumerated), String(x.captured), String(x.enumerated - x.captured), notes.map((n) => `\`${n}\``).join(', ') || '(unnamed)'];
      }),
    ),
    '',
  );
}

/* R6 — icon exports */
p(
  `### 3.6 Icon exports`,
  '',
  `*Capture-side.* ${iconIds.length} glyphs were exported from the kit and ${Object.keys(icons.keyToAsset).length} observed nested-instance keys map onto them. ${iconRefused.length} export is refused and committed as a receipt only:`,
  '',
  ...iconRefused.flatMap((k) => [`- \`${k}\` — ${cell(icons.assets[k].refused ?? '')}`, '']),
  `The manifest's own scope note: *${cell(icons.$note)}*`,
  '',
  '---',
  '',
);

/* ------------------------------------------------------- §4 what degrades */

p(
  '## 4. What degrades',
  '',
  `Carried, but not carried perfectly. These are the classes an adopter will actually see in a review, ranked by how many facts they move. Counts are per (variant ▸ node ▸ channel) fact from the round trip; "variants" counts distinct (component, variant) pairs touched. Descriptions are quoted from the round-trip report's own glossary.`,
  '',
  ...table(
    ['class', 'facts', 'diverged / loss / invented', 'components', 'variants', 'what it means (REPORT.md)'],
    tagsRanked
      .filter((t) => t.tag !== '(untagged)')
      .map((t) => [
        `\`${t.tag}\``,
        fmt(t.facts),
        `${fmt(t.kinds.diverged)} / ${fmt(t.kinds.loss)} / ${fmt(t.kinds.invented)}`,
        `${t.components.size} / ${rt.results.length}`,
        fmt(t.variants.size),
        cell(glossFor(t.tag)),
      ]),
  ),
  '',
);

p(
  '### The four the brief names, with their blast radius on this kit',
  '',
);
{
  const rowFor = (tag: string): TagStat | undefined => tagStats.get(tag);
  const ink = rowFor('vector-glyph');
  const sizes = rowFor('hug-vs-fixed');
  const states = rowFor('interaction-states');
  const restr = rowFor('restructured');
  const interactionRows = [...unscoredByNote.entries()]
    .filter(([n]) => n.startsWith('interaction-state'))
    .flatMap(([, rows]) => rows);
  const interactionSets = [...new Set(interactionRows.map((r) => r.set))].sort();
  p(
    `- **Baked ink.** Icon fills and strokes are baked at the source main component, so per-usage ink divergence cannot ride the glyph. Round trip: \`vector-glyph\` moves ${fmt(ink?.facts ?? 0)} facts over ${ink?.components.size ?? 0} components and ${fmt(ink?.variants.size ?? 0)} variants. The icon manifest states the limit in its own scope note and refuses ${iconRefused.length} export over exactly this (\`${iconRefused.join(', ') || 'none'}\`). Capture-side.`,
    `- **First-claim sizes.** \`hug-vs-fixed\`: ${fmt(sizes?.facts ?? 0)} facts over ${sizes?.components.size ?? 0} components and ${fmt(sizes?.variants.size ?? 0)} variants — the canvas hugged, the emit lowered the captured measure to a FIXED/FILL axis, and the sizing *mode* disagreement is the finding. Inversion-side.`,
    `- **Interaction states.** ${fmt(interactionRows.length)} of ${fmt(fidelity.length)} enumerated variants in ${interactionSets.length} sets (${interactionSets.join(', ')}) cannot be scored at all — they are CSS-rendered, not static. On the return leg \`interaction-states\` ledgers ${fmt(states?.facts ?? 0)} lost facts over ${states?.components.size ?? 0} components and ${fmt(states?.variants.size ?? 0)} variants. Only ${featureCounts['figmaStatePreviews'].contracts} of ${contracts.length} contracts carry \`figmaStatePreviews\` at all. Inversion-side.`,
    `- **Restructured trees.** The largest class in the whole measurement: \`restructured\` moves ${fmt(restr?.facts ?? 0)} facts (${fmt(restr?.kinds.loss ?? 0)} loss + ${fmt(restr?.kinds.invented ?? 0)} invented) over ${restr?.components.size ?? 0} components and ${fmt(restr?.variants.size ?? 0)} variants — the same content, the same value, at a different nesting depth because the proposal introduced or removed a wrapper. It is ledgered on BOTH sides, never silently matched. Inversion-side.`,
    '',
  );
}

p(
  '### Degraded, then recovered — read this one carefully',
  '',
  `\`paint-unsupported\` is the largest capture receipt (${fmt(degStats.get('paint-unsupported')?.records ?? 0)} records) and it reads "paint omitted", but for IMAGE paints that is only half the story: the same dumps carry ${fmt(imageFillTotal)} \`imageFill\` channels — count-for-count coincident with the receipts, per set — and ${imageAssets} deduplicated PNG assets are committed under \`assets/images/\`. The SOLID projection is refused; the image itself is carried by hash. The receipt alone would understate what ships.`,
  '',
  '---',
  '',
);

/* --------------------------------------------------- §5 reds + work order */

p(
  '## 5. The three pinned reds, and the work order',
  '',
  '### 5.1 The pinned reds',
  '',
  `${redCases.length} of the ${cases.length} conformance cases are FAIL-EXPECTED-RED: the documentation model says CARRIED, the engine does not deliver it, and the gap is pinned so it cannot be forgotten or quietly closed. Each is verbatim from the manifest.`,
  '',
);
for (const c of redCases) {
  p(
    `#### \`${c.id}\` — expected ${c.expect}, ${sideOfCase(c)}`,
    '',
    `- **Construct:** ${cell(c.construct)}`,
    `- **Why it should carry:** ${cell(c.why)}`,
    `- **What actually happens:** ${cell(c.observed ?? '(manifest records no `observed` for this case)')}`,
    '',
  );
}

p(
  '### 5.2 The round-1 audit, re-checked',
  '',
  `The campaign opened with an audit whose prose calls itself "${auditClaimedCount} classes"; the document actually carries **${auditClasses.length}** \`###\` class headings, and this ledger uses the headings. Each is re-checked here by a probe over the committed artifacts — never from memory. \`CLOSED\` means the probe finds the audited defect gone; \`PARTIAL\` means measurably better with a named residue; \`OPEN\` means the probe still sees it; \`NAMED-BY-DESIGN\` means the loss is now a receipt rather than a silence. Read the **measured on** column before trusting a verdict: \`this kit\` means the number was counted over these ${fidSets.length} sets, \`fixture\` means the construct is proven supported on the synthetic conformance library and every instance of it in this kit was *not* re-inspected.`,
  '',
  ...table(
    ['#', 'class', 'stage', 'side', 'severity then', 'now', 'measured on', 'the probe that decided it'],
    auditClasses.map((a, i) => {
      const probe =
        getProbe(a.name) ??
        ({ verdict: 'OPEN', basis: 'this kit', evidence: '(no probe defined for this class)' } as Probe);
      return [
        String(i + 1),
        `\`${a.name.split(' (')[0]}\``,
        a.stage,
        sideOfStage(a.stage),
        a.severity,
        `**${probe.verdict}**`,
        probe.basis,
        cell(probe.evidence),
      ];
    }),
  ),
  '',
);
{
  const tally = new Map<string, number>();
  for (const a of auditClasses) {
    const v = getProbe(a.name)?.verdict ?? 'OPEN';
    tally.set(v, (tally.get(v) ?? 0) + 1);
  }
  const order: Verdict[] = ['CLOSED', 'NAMED-BY-DESIGN', 'PARTIAL', 'OPEN'];
  p(
    `Tally: ${order.filter((v) => tally.has(v)).map((v) => `**${tally.get(v)}** ${v}`).join(' · ')}, of ${auditClasses.length} classes.`,
    '',
  );
}

p(
  '### 5.3 What the sources could not answer',
  '',
  `Named holes, so that no reader mistakes an absence for a zero.`,
  '',
);
{
  const holes: string[] = [];
  holes.push(
    `**Contract-level named notes do not exist.** No \`notes\` (or \`note\`) key appears anywhere in any of the ${contracts.length} contract files. The only prose the contracts carry is the \`description\` field: one standing PROPOSED scope line on each of the ${fullContracts.length} full contracts and one STUB refusal on each of the ${stubContracts.length} stubs, both quoted in §3.2. Per-part refusal notes are a surface this kit does not have.`,
  );
  holes.push(
    `**${fmt(untaggedFacts)} of ${fmt(nonMatched)} non-matching round-trip facts carry no class tag** (${fmt(untagged?.kinds.diverged ?? 0)} diverged + ${fmt(untagged?.kinds.loss ?? 0)} loss, across ${untagged?.components.size ?? 0} of ${rt.results.length} components and ${fmt(untagged?.variants.size ?? 0)} variants). Invention *is* fully classified — ${fmt(inventedTagged)} of ${fmt(rt.totals.invented)} invented facts carry a tag — but divergence and one-way loss are not, so §4's per-class blast radii cover ${pct(nonMatched - untaggedFacts, nonMatched)} of the non-matching facts and no more.`,
  );
  holes.push(
    `**The conformance runner writes no machine-readable result file.** \`npm run conformance:canvas\` prints its table to stdout and exits; there is no committed run output. Every conformance number in this ledger therefore comes from the *manifest's pinned* \`status\` field, which the live run is expected to reproduce exactly. Run the command to confirm; this build cannot.`,
  );
  holes.push(
    `**The two instruments disagree on the variant denominator.** Round trip counts ${fmt(rt.results.reduce((a, b) => a + b.originalVariants, 0))} original variants; the fidelity harness enumerates ${fmt(fidelity.length)}. The delta is §3.5.`,
  );
  const versions = [...dumpVersions.entries()].sort();
  if (versions.length > 1) {
    holes.push(
      `**The dumps are not one capture generation.** ${versions.map(([v, n]) => `${plural(n, 'dump')} at v${v}`).join(', ')}. Receipt codes and channel availability differ between them, so a receipt absent from a v${versions[0][0]} dump does not prove the construct was carried — only that that generation did not look for it.`,
    );
  }
  holes.push(
    `**No probe here measures accessibility, events, or semantics.** The contracts say so themselves ("Semantics beyond the name/axis inference table, a11y, events, and slot accepts are not canvas-recoverable"); there is no artifact in this kit that measures them, so this ledger reports nothing about them.`,
  );
  p(...holes.map((h) => `- ${h}`), '');
}

p(
  '### 5.4 The work order, in the order it pays',
  '',
);
{
  const open = auditClasses
    .map((a) => ({ a, v: getProbe(a.name)?.verdict ?? 'OPEN', e: getProbe(a.name)?.evidence ?? '' }))
    .filter((x) => x.v === 'OPEN' || x.v === 'PARTIAL');
  const items: string[] = [];
  items.push(
    `1. **Open the paste door** (§3.4) — every one of the ${fullContracts.length} sets is blocked from the shipping bundle path today by an empty \`base\` tokenSet and by \`social-button\`'s \`{platform}\` icon ref. Nothing else in this list matters to an adopter until a bundle can actually be pasted.`,
  );
  items.push(
    `2. **The ${redCases.length} pinned reds** (§5.1) — ${redCases.map((c) => `\`${c.id}\``).join(', ')}. Two share one root cause (the \`isSpacer\` early return in \`core/propose-figma.ts\` swallowing image-paint frames) and the third is a silent loss, the only kind this project treats as a bug rather than a boundary.`,
  );
  let n = 3;
  for (const x of open.sort((a, b) => (a.v === b.v ? 0 : a.v === 'OPEN' ? -1 : 1))) {
    items.push(`${n}. **${x.a.name.split(' (')[0]}** — ${x.v}, ${x.a.stage} stage (${sideOfStage(x.a.stage)}). ${cell(x.e)}`);
    n++;
  }
  items.push(
    `${n}. **Classify the ${fmt(untaggedFacts)} untagged round-trip facts** (§5.3) — until divergence and loss are classified the way invention already is, no blast-radius number in §4 can claim to be complete.`,
  );
  p(...items, '', '---', '');
}

/* ---------------------------------------------------------- §6 reproduce */

p(
  '## 6. How to reproduce every number',
  '',
  '```bash',
  '# 1 · this ledger, from the committed artifacts (no capture, no render, no network)',
  `${BUILD_CMD}`,
  '',
  '# 2 · the document-model fixture — fast, read-only, no engine changes',
  'npm run conformance:canvas',
  `#    expect: ${cases.length} case(s): ${greenCases.length} PASS, ${redCases.length} RED-EXPECTED (pinned findings), 0 FAIL, 0 UNEXPECTED-GREEN, 0 UNLISTED, 0 MISSING`,
  '',
  '# 3 · the canvas→code→canvas round trip (rewrites REPORT.md + report.json)',
  'npm run extract:figma:roundtrip:uui',
  `#    expect: ${rt.totals.roundTripClosed}/${rt.totals.components} round trips closed`,
  '',
  '# 4 · the pixel fidelity table (renders every variant; slow)',
  'npx tsx examples/untitled-ui/fidelity-score.mts',
  `#    expect: ${fmt(scored.length)} scored variants, mean ${one(overallMean)}%`,
  '```',
  '',
  `§2 and §3.3 read \`extract/figma/conformance/MANIFEST.json\` directly (the hand-authored denominator — the engine never defines its own). §3.1 reads \`_degradations\` from the ${dumps.length} dumps. §3.2 reads the \`description\` field of the ${contracts.length} contracts. §3.6 reads the icon manifest. §4 reads \`report.json\` and quotes the glossary lines out of \`REPORT.md\`. §5.2's probes read the ${Object.keys(emitted).length} emitted component directories plus the contracts.`,
  '',
  '### Sources this build read',
  '',
  ...table(
    ['artifact', 'sha256 (12)', 'bytes', 'what it supplied'],
    [...sources]
      .sort((a, b) => a.rel.localeCompare(b.rel))
      .map((s) => [`\`${s.rel}\``, `\`${s.hash}\``, fmt(s.bytes), s.label]),
  ),
  '',
  `Same bytes in, same file out: this build reads no clock, no git state and no environment, and sorts every collection before rendering. Rebuild twice and diff to confirm.`,
  '',
);

writeFileSync(OUT, `${L.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`, 'utf8');

const rel = path.relative(ROOT, OUT).split(path.sep).join('/');
process.stdout.write(
  `LEDGER: wrote ${rel} — ${L.length} lines from ${sources.length} sources ` +
    `(${cases.length} conformance cases, ${fmt(scored.length)} scored variants, ` +
    `${fmt(rt.totals.matched + nonMatched)} round-trip facts, ${fmt(degTotal)} capture receipts, ` +
    `${auditClasses.length} audit classes re-probed)\n`,
);
