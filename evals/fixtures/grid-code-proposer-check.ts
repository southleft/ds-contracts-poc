/**
 * grid-code-proposer check (A2 — the code-side surface of the pinned layout
 * grammar; docs/research/layout-grammar-proposal.md G1–G7, probes P1–P14).
 *
 * WHAT THIS PINS:
 *   1. The CSS-Module anatomy path inverts a bento grid EXACTLY: display:
 *      grid + grid-template-rows/columns (px/fr fractional ok) + the gap
 *      pair + per-child grid-row/grid-column spans + justify-self/align-self
 *      → a schema-valid proposed contract carrying layout.rows/columns/gap
 *      and Part.placement (0-based cells — the proposer's −1 of the
 *      emitter's +1).
 *   2. grid-template-areas → G4 layout.areas; an area-named part carries NO
 *      explicit placement (the area name IS the anchor); a grid-area that
 *      does not match the part name is a NAMED refusal note.
 *   3. Every G7 construct refuses BY NAME with a receipt in the proposal
 *      notes — minmax, auto-fit, percent tracks, subgrid, column flow,
 *      dense, implicit tracks (grid-auto-rows), zero tracks, baseline
 *      self-alignment — and none of them leaks a track/placement fact.
 *      `auto` tracks and `stretch` self-alignment are NAMED LOWERED
 *      dispositions, never silent.
 *   4. The differ fact classes: anatomy channel lines carry grid facts in
 *      named buckets (layout.rows / layout.gap.row / layout.areas.<name> /
 *      placement.cell / placement.align) and a grid↔flex display change
 *      yields the P10 STRUCTURAL finding on top of per-fact removals.
 *   5. The design round-trip comparator buckets grid facts by name
 *      (grid-track-list / grid-gap / grid-area-map / grid-flow /
 *      grid-placement / grid-align), treats a contract area rect recovered
 *      as an explicit placement as the SAME canvas fact (G4), and surfaces
 *      grid↔flex as ONE structural mismatch.
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import { proposeFromCode } from '../../core/propose-code.js';
import { anatomyChannelLines, diffContractAnatomy, gridModeSwitchFindings } from '../../core/anatomy-diff.js';
import { compareContracts } from '../../extract/figma/roundtrip.js';
import { loadTokenCorpus } from '../../extract/figma/tokens.js';
import type { Contract } from '../../scripts/contract-schema.js';

const fail = (msg: string): never => {
  console.error(`✘ grid-code-proposer: ${msg}`);
  process.exit(1);
};

const TOKENS = [
  {
    space: {
      3: { $type: 'dimension', $value: '12px' },
      4: { $type: 'dimension', $value: '16px' },
    },
  },
];

// ---------------------------------------------------------------------------
// 1+2. Bento inversion — the P8 shape spelled as a CSS Module component
// ---------------------------------------------------------------------------
const TSX = `
import styles from './Bento.module.css';
export interface BentoProps {}
export function Bento({}: BentoProps) {
  return (
    <div className={styles.root}>
      <div className={styles.header} />
      <div className={styles.sidebar} />
      <div className={styles.main} />
      <div className={styles.rail} />
      <div className={styles.footer} />
    </div>
  );
}
`;
const CSS = `
.root {
  display: grid;
  grid-template-rows: 80px 1fr 2.5fr;
  grid-template-columns: 160px 1fr 1fr 120px;
  gap: var(--space-3) 16px;
}
.header { grid-row: 1; grid-column: 1 / span 4; }
.sidebar { grid-row: 2 / span 2; grid-column: 1; }
.main { grid-row: 2; grid-column: 2 / 4; justify-self: center; align-self: end; }
.rail { grid-row: 2 / span 2; grid-column: 4; }
.footer { grid-row: 3; grid-column: 2 / span 2; }
`;

const result = proposeFromCode(
  { sourcePath: 'x/Bento.tsx', source: TSX, css: CSS },
  { tokens: TOKENS, prefix: 'ds' },
);
if (result.proposals.length !== 1) fail(`expected 1 proposal, got ${result.proposals.length}`);
const bento = result.proposals[0].proposal.contract as Record<string, any>;
const eq = (a: unknown, b: unknown, what: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
const root = bento.anatomy.root;
eq(root.layout.display, 'grid', 'root display');
eq(root.layout.rows, [{ px: 80 }, { fr: 1 }, { fr: 2.5 }], 'row tracks (fractional fr carried exactly, P2b)');
eq(root.layout.columns, [{ px: 160 }, { fr: 1 }, { fr: 1 }, { px: 120 }], 'column tracks');
eq(root.layout.gap, { row: '{space.3}', column: 16 }, 'gap pair (token ref + px — independent facts, P2)');
eq(root.parts.header.placement, { row: 0, column: 0, columnSpan: 4 }, 'header cell (CSS 1-based → contract 0-based)');
eq(root.parts.sidebar.placement, { row: 1, column: 0, rowSpan: 2 }, 'sidebar cell');
eq(root.parts.main.placement, { row: 1, column: 1, columnSpan: 2, alignX: 'center', alignY: 'end' }, 'main cell + aligns');
eq(root.parts.rail.placement, { row: 1, column: 3, rowSpan: 2 }, 'rail cell');
eq(root.parts.footer.placement, { row: 2, column: 1, columnSpan: 2 }, 'footer cell');

// ---------------------------------------------------------------------------
// 2. G4 areas — the name IS the anchor; names enter the contract HERE
// ---------------------------------------------------------------------------
const AREA_TSX = `
import styles from './Shell.module.css';
export interface ShellProps {}
export function Shell({}: ShellProps) {
  return (
    <div className={styles.root}>
      <div className={styles.header} />
      <div className={styles.nav} />
      <div className={styles.content} />
    </div>
  );
}
`;
const AREA_CSS = `
.root {
  display: grid;
  grid-template-rows: 64px 1fr;
  grid-template-columns: 240px 1fr;
  grid-template-areas: "header header" "nav content";
  gap: 12px;
}
.header { grid-area: header; }
.nav { grid-area: nav; }
.content { grid-area: mislabeled; }
`;
const shellRun = proposeFromCode({ sourcePath: 'x/Shell.tsx', source: AREA_TSX, css: AREA_CSS }, { tokens: TOKENS, prefix: 'ds' });
const shell = shellRun.proposals[0].proposal.contract as Record<string, any>;
const shellNotes = shellRun.proposals[0].proposal.notes;
eq(
  shell.anatomy.root.layout.areas,
  { header: { row: 0, column: 0, columnSpan: 2 }, nav: { row: 1, column: 0 }, content: { row: 1, column: 1 } },
  'grid-template-areas → G4 areas map',
);
eq(shell.anatomy.root.layout.gap, { row: 12, column: 12 }, 'one-value gap → the pair (named LOWERED normalization)');
if (shell.anatomy.root.parts.header.placement !== undefined) fail('area-named part must NOT carry explicit placement (the area name IS the anchor, G4)');
if (!shellNotes.some((n: string) => n.includes('grid-area "mislabeled"') && n.includes('must equal the part name'))) {
  fail(`grid-area/part-name mismatch not receipted by name:\n${shellNotes.join('\n')}`);
}

// ---------------------------------------------------------------------------
// 3. The G7 fence — every refusal NAMED in the receipts, nothing leaks
// ---------------------------------------------------------------------------
const FENCE_TSX = `
import styles from './Fence.module.css';
export interface FenceProps {}
export function Fence({}: FenceProps) {
  return (
    <div className={styles.root}>
      <div className={styles.a} />
    </div>
  );
}
`;
const FENCE_CSS = `
.root {
  display: grid;
  grid-template-columns: minmax(100px, 300px) 1fr;
  grid-template-rows: repeat(auto-fit, minmax(100px, 1fr));
  grid-auto-flow: column;
  grid-auto-rows: 40px;
}
.a { grid-column: -1; align-self: baseline; justify-self: stretch; grid-row: 1; }
`;
const fence = proposeFromCode({ sourcePath: 'x/Fence.tsx', source: FENCE_TSX, css: FENCE_CSS }, { tokens: TOKENS, prefix: 'ds' });
const fenceRoot = (fence.proposals[0].proposal.contract as Record<string, any>).anatomy.root;
if (fenceRoot.layout?.columns !== undefined || fenceRoot.layout?.rows !== undefined) {
  fail(`refused track constructs leaked into layout: ${JSON.stringify(fenceRoot.layout)}`);
}
if (fenceRoot.layout?.flow !== undefined) fail('grid-auto-flow: column leaked into layout.flow');
if (fenceRoot.parts.a.placement !== undefined) fail('refused child placement leaked (negative line / half-anchored)');
const fenceNotes = fence.proposals[0].proposal.notes.join('\n');
for (const [construct, needle] of [
  ['minmax', 'grid-track-minmax'],
  ['auto-fit', 'grid-auto-fit-minmax'],
  ['column flow', 'grid-flow-column'],
  ['implicit tracks', 'grid-implicit-tracks'],
  ['negative line', 'grid-negative-line'],
  ['baseline align', 'grid-baseline-align'],
  ['stretch keyword', 'grid-align-stretch-keyword'],
] as const) {
  if (!fenceNotes.includes(needle)) fail(`${construct} not refused BY NAME (${needle}) in the receipts:\n${fenceNotes}`);
}

// zero track + percent + subgrid + dense, spot checks through the same door
const Z_CSS = `
.root { display: grid; grid-template-columns: 0px 50% subgrid; grid-template-rows: 1fr; grid-auto-flow: dense; }
`;
const z = proposeFromCode({ sourcePath: 'x/Fence.tsx', source: FENCE_TSX, css: Z_CSS }, { tokens: TOKENS, prefix: 'ds' });
const zNotes = z.proposals[0].proposal.notes.join('\n');
for (const needle of ['grid-track-zero', 'grid-track-percent', 'grid-subgrid', 'grid-flow-dense'] as const) {
  if (!zNotes.includes(needle)) fail(`${needle} not refused BY NAME:\n${zNotes}`);
}
const zRoot = (z.proposals[0].proposal.contract as Record<string, any>).anatomy.root;
if (zRoot.layout?.columns !== undefined) fail('zero/percent/subgrid tracks leaked');

// `auto` track — NAMED LOWERED to {fit:true}, never silent
const AUTO_CSS = `
.root { display: grid; grid-template-columns: auto 1fr fit-content(100%); grid-template-rows: 32px; }
.a { grid-row: 1; grid-column: 2; }
`;
const auto = proposeFromCode({ sourcePath: 'x/Fence.tsx', source: FENCE_TSX, css: AUTO_CSS }, { tokens: TOKENS, prefix: 'ds' });
const autoRoot = (auto.proposals[0].proposal.contract as Record<string, any>).anatomy.root;
eq(autoRoot.layout.columns, [{ fit: true }, { fr: 1 }, { fit: true }], 'auto → {fit:true} (LOWERED), fit-content(100%) exact (P14)');
if (!auto.proposals[0].proposal.notes.join('\n').includes('LOWERED')) fail('auto→fit lowering not receipted');

// ---------------------------------------------------------------------------
// 4. Differ fact classes + the P10 structural rule
// ---------------------------------------------------------------------------
const gridContract = bento as unknown as Contract;
const lines = anatomyChannelLines(gridContract);
const expectLine = (needle: string) => {
  if (!lines.some((l) => l.includes(needle))) fail(`anatomy channel lines missing bucket ${needle}:\n${lines.join('\n')}`);
};
expectLine('root|layout.rows|');
expectLine('root|layout.columns|');
expectLine('root|layout.gap.row|');
expectLine('root|layout.gap.column|');
expectLine('root/sidebar|placement.cell|{"row":1,"column":0,"rowSpan":2}');
expectLine('root/main|placement.align|center/end');

const flexed = structuredClone(bento) as Record<string, any>;
flexed.anatomy.root = { layout: { display: 'flex', direction: 'row' } };
const switchChanges = diffContractAnatomy(gridContract, flexed as unknown as Contract);
const structural = switchChanges.filter((c) => c.channel === 'layout.mode-switch');
if (structural.length !== 1 || !structural[0].now.includes('P10')) {
  fail(`grid→flex must yield exactly one named P10 structural finding, got ${JSON.stringify(structural)}`);
}
if (!switchChanges.some((c) => c.channel === 'layout.rows' && c.now === '(removed)')) {
  fail('per-fact track removals must stay visible alongside the structural finding');
}
if (gridModeSwitchFindings(diffContractAnatomy(gridContract, gridContract)).length !== 0) {
  fail('identity diff must carry no structural finding');
}

// ---------------------------------------------------------------------------
// 5. Design round-trip comparator — named grid buckets, G4 rect recovery
// ---------------------------------------------------------------------------
const corpus = loadTokenCorpus(process.cwd());
const identical = compareContracts(bento, structuredClone(bento), corpus);
if (identical.some((f) => f.status === 'mismatch')) {
  fail(`identity grid comparison must have zero mismatch: ${JSON.stringify(identical.filter((f) => f.status === 'mismatch'))}`);
}
const bucketNames = identical.filter((f) => f.status === 'matched').map((f) => f.subject).join('\n');
for (const bucket of ['grid-track-list rows', 'grid-track-list columns', 'grid-gap row', 'grid-gap column', 'grid-placement']) {
  if (!bucketNames.includes(bucket)) fail(`comparator missing named bucket "${bucket}":\n${bucketNames}`);
}

const modeSwitched = structuredClone(bento) as Record<string, any>;
modeSwitched.anatomy.root.layout = { display: 'flex', direction: 'row' };
for (const part of Object.values(modeSwitched.anatomy.root.parts) as Array<Record<string, unknown>>) delete part.placement;
const switched = compareContracts(bento, modeSwitched, corpus);
const modeFindings = switched.filter((f) => f.subject === 'part root layout.mode');
if (modeFindings.length !== 1 || modeFindings[0].status !== 'mismatch' || !modeFindings[0].detail?.includes('P10')) {
  fail(`grid vs flex must be ONE named structural mismatch, got ${JSON.stringify(modeFindings)}`);
}

// G4: shipping areas vs proposal explicit placements of the same rects —
// the SAME canvas facts (names are contract-owned, buckets say so).
const shipping = shell;
const recovered = structuredClone(shell) as Record<string, any>;
delete recovered.anatomy.root.layout.areas;
recovered.anatomy.root.parts.header.placement = { row: 0, column: 0, columnSpan: 2 };
recovered.anatomy.root.parts.nav.placement = { row: 1, column: 0 };
recovered.anatomy.root.parts.content.placement = { row: 1, column: 1 };
const areaFindings = compareContracts(shipping, recovered, corpus);
if (areaFindings.some((f) => f.status === 'mismatch' && f.subject.includes('grid-'))) {
  fail(`area rects recovered as explicit placements must not mismatch (G4): ${JSON.stringify(areaFindings.filter((f) => f.status === 'mismatch'))}`);
}
const areaAbsent = areaFindings.find((f) => f.subject === 'part root grid-area-map');
if (!areaAbsent || areaAbsent.status !== 'canvas-absent' || !areaAbsent.detail?.includes('contract-owned')) {
  fail(`area-name ownership must be a NAMED canvas-absent bucket, got ${JSON.stringify(areaAbsent)}`);
}
const placedOk = areaFindings.filter((f) => f.subject.endsWith('grid-placement') && f.status === 'matched');
if (placedOk.length !== 3) fail(`expected 3 matched grid-placement buckets via effective rects, got ${placedOk.length}`);

console.log(
  'grid-code-proposer ok: bento inversion exact (tracks/gap-pair/0-based cells/aligns), G4 areas carried with name-anchoring referee, ' +
    'G7 fence refuses by name (minmax/auto-fit/percent/subgrid/zero/column/dense/implicit/negative/baseline) with auto+stretch as NAMED lowerings, ' +
    'differ buckets grid facts (track-list/gap/placement.cell/placement.align) with the P10 structural finding, ' +
    'and the round-trip comparator names every grid bucket incl. G4 rect recovery',
);
