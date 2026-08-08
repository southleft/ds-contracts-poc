/**
 * grid-bento-carriage eval body (A2 — the layout-grammar core).
 *
 * THE CANONICAL CASE, end to end: `grid-bento-span-matrix` from
 * conformance/layout-cases-draft/MANIFEST.json — the exact 3×4 bento the live
 * probe round-tripped on a real canvas (docs/research/grid-recon-probes.md
 * P8, receipt assets/grid-recon/p8-bento-roundtrip.png): rows [80px,1fr,2fr],
 * columns [160px,1fr,1fr,120px], gaps 12/16, five FILL children — header
 * (0,0 span 1×4), sidebar (1,0 span 2×1), main (1,1 span 1×2), rail (1,3
 * span 2×1), footer (2,1 span 1×2).
 *
 * WHAT THIS PINS:
 *   1. The contract spelling parses (G1/G2 pinned grammar) and the emitted
 *      .figma.js is BYTE-DETERMINISTIC across two emissions.
 *   2. The compiled spec carries every track/anchor/span/gap fact.
 *   3. Executed HEADLESSLY through the same mock the genesis receipts use —
 *      whose grid model enforces the REAL API's refusals (count-before-sizes
 *      throw, place-before-span occupancy throw, align enum fence, P9
 *      overflow absorption, P10 mode-switch destruction) — the built
 *      COMPONENT reads back every fact EXACTLY, plus the P8 geometry math
 *      (sidebar 160 wide; fr columns gap-corrected).
 *   4. The emitted runtime text carries the probe-pinned ORDER (mode →
 *      counts → sizes → gaps → append → place → span → FILL → align) and the
 *      P9/P10 declaration guard.
 *   5. Every G7 construct refuses BY NAME at the schema (the fence).
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import vm from 'node:vm';
import {
  ContractSchema,
  LayoutSchema,
  PartSchema,
  type Contract,
} from '../../scripts/contract-schema.js';
import { emitFigmaScript } from '../../core/emit-figma-script.js';
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';

const fail = (msg: string): never => {
  console.error(`✘ grid-bento: ${msg}`);
  process.exit(1);
};

const TOKENS = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };

// --- the canonical bento contract (grid-bento-span-matrix, P8) --------------
const bento = (): Contract =>
  ContractSchema.parse({
    id: 'ds.eval-bento',
    name: 'EvalBento',
    version: '0.1.0',
    status: 'draft',
    description: 'grid-bento-span-matrix fixture — the P8 carriage receipt, headless',
    semantics: { element: 'div' },
    props: [],
    states: [],
    anatomy: {
      root: {
        layout: {
          display: 'grid',
          rows: [{ px: 80 }, { fr: 1 }, { fr: 2 }],
          columns: [{ px: 160 }, { fr: 1 }, { fr: 1 }, { px: 120 }],
          gap: { row: 12, column: 16 },
        },
        literals: { width: '640px', height: '480px' },
        parts: {
          header: { placement: { row: 0, column: 0, columnSpan: 4 }, literals: { 'background-color': '#e0e0e0' } },
          sidebar: { placement: { row: 1, column: 0, rowSpan: 2 }, literals: { 'background-color': '#d0d0d0' } },
          main: { placement: { row: 1, column: 1, columnSpan: 2 }, literals: { 'background-color': '#f0f0f0' } },
          rail: { placement: { row: 1, column: 3, rowSpan: 2 }, literals: { 'background-color': '#c0c0c0' } },
          footer: { placement: { row: 2, column: 1, columnSpan: 2 }, literals: { 'background-color': '#b0b0b0' } },
        },
      },
    },
    anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'EvalBento' } },
  }) as Contract;

const emit = (c: Contract): string =>
  emitFigmaScript(c, { tokens: TOKENS, icons: new Map(), contracts: new Map([[c.id, c]]) });

// ---- 1. byte-determinism ×2 ------------------------------------------------
const script = emit(bento());
if (script !== emit(bento())) fail('two emissions of the same bento contract are not byte-identical');

// ---- 2. the compiled spec carries every fact -------------------------------
const m = /const COMPONENTS = (\[[\s\S]*?\n\]);/.exec(script);
if (!m) fail('emitted script has no COMPONENTS payload');
const spec = JSON.parse(m![1])[0].variants[0].spec as Record<string, any>;
const g = spec.layout?.grid;
if (spec.layout?.mode !== 'GRID' || !g) fail(`root spec is not a GRID: ${JSON.stringify(spec.layout)}`);
const eq = (a: unknown, b: unknown, what: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
};
eq(g.rows, [{ type: 'FIXED', value: 80 }, { type: 'FLEX', value: 1 }, { type: 'FLEX', value: 2 }], 'spec row tracks');
eq(g.columns, [{ type: 'FIXED', value: 160 }, { type: 'FLEX', value: 1 }, { type: 'FLEX', value: 1 }, { type: 'FIXED', value: 120 }], 'spec column tracks');
eq([g.rowGap, g.columnGap], [12, 16], 'spec gaps');
const cellOf = (name: string) => {
  const c = (spec.children as Array<Record<string, any>>).find((x) => x.name === name);
  if (!c) fail(`spec child "${name}" missing`);
  return c!.cell as Record<string, number>;
};
eq(cellOf('header'), { row: 0, column: 0, columnSpan: 4 }, 'header cell');
eq(cellOf('sidebar'), { row: 1, column: 0, rowSpan: 2 }, 'sidebar cell');
eq(cellOf('main'), { row: 1, column: 1, columnSpan: 2 }, 'main cell');
eq(cellOf('rail'), { row: 1, column: 3, rowSpan: 2 }, 'rail cell');
eq(cellOf('footer'), { row: 2, column: 1, columnSpan: 2 }, 'footer cell');

// ---- 3. headless execution: full readback through the strict mock ----------
const mock = createFigmaMock();
const ctx = vm.createContext({ figma: mock.figma, console: { log() {}, warn() {}, error() {} } });
await vm.runInContext(`(async () => {\n${script}\n})()`, ctx, { timeout: 120_000 });
const comp = mock.root.findAll((n: any) => n.type === 'COMPONENT')[0];
if (!comp) fail('no COMPONENT built');
if (comp.layoutMode !== 'GRID') fail(`built node layoutMode ${comp.layoutMode}, expected GRID`);
eq(comp.gridRowSizes, [{ type: 'FIXED', value: 80 }, { type: 'FLEX', value: 1 }, { type: 'FLEX', value: 2 }], 'readback row tracks');
eq(comp.gridColumnSizes, [{ type: 'FIXED', value: 160 }, { type: 'FLEX', value: 1 }, { type: 'FLEX', value: 1 }, { type: 'FIXED', value: 120 }], 'readback column tracks');
eq([comp.gridRowGap, comp.gridColumnGap], [12, 16], 'readback gaps');
eq(comp.gridItemsPositioning, 'MANUAL', 'readback itemsPositioning');
const kid = (name: string) => {
  const n = comp.children.find((c: any) => c.name === name);
  if (!n) fail(`built child "${name}" missing`);
  return n;
};
const expectKid = (name: string, r: number, c: number, rs: number, cs: number) => {
  const n = kid(name);
  const got = [n.gridRowAnchorIndex, n.gridColumnAnchorIndex, n.gridRowSpan, n.gridColumnSpan];
  eq(got, [r, c, rs, cs], `${name} anchor/span readback`);
  if (n.layoutSizingHorizontal !== 'FILL' || n.layoutSizingVertical !== 'FILL') {
    fail(`${name} must FILL both axes of its cell (G3) — got ${n.layoutSizingHorizontal}/${n.layoutSizingVertical}`);
  }
};
expectKid('header', 0, 0, 1, 4);
expectKid('sidebar', 1, 0, 2, 1);
expectKid('main', 1, 1, 1, 2);
expectKid('rail', 1, 3, 2, 1);
expectKid('footer', 2, 1, 1, 2);
// P8 geometry math (gap-corrected cell sizes; 640×480 box):
//   free width = 640-160-120-3·16 = 312 → each 1fr col = 156
//   free height = 480-80-2·12 = 376 → 1fr row = 376/3, 2fr row = 2·376/3
const near = (a: number, b: number, what: string) => {
  if (Math.abs(a - b) > 0.01) fail(`${what}: expected ${b}, got ${a}`);
};
near(kid('header').width, 640, 'header spans the full 4-column width');
near(kid('sidebar').width, 160, 'sidebar rides the 160px rail track');
near(kid('main').width, 156 + 156 + 16, 'main = two 1fr columns + one gap');
near(kid('sidebar').height, 376 + 12, 'sidebar = 1fr+2fr rows + one gap');
near(kid('footer').height, (2 * 376) / 3, 'footer = the 2fr row');

// ---- 4. the emitted runtime text carries the probe-pinned order ------------
const orderOf = (...needles: string[]) => {
  let at = -1;
  for (const n of needles) {
    const i = script.indexOf(n, at + 1);
    if (i < 0) fail(`emitted runtime is missing "${n}" (or has it out of the probe-pinned order)`);
    at = i;
  }
};
orderOf(
  "node.layoutMode = 'GRID'",
  'node.gridRowCount = g.rows.length',
  'node.gridRowSizes = ',
  'node.gridRowGap = g.rowGap',
  'function applyGridChildren',
  'grid-declaration-rewritten',
  'setGridChildPosition(',
  '.gridRowSpan = ',
  "layoutSizingHorizontal = 'FILL'",
  'gridChildHorizontalAlign',
);

// ---- 5. the mock is a strict instrument, not an alibi ----------------------
{
  const m2 = createFigmaMock();
  const f = m2.figma.createFrame();
  f.layoutMode = 'GRID';
  let threw = '';
  try { f.gridColumnSizes = [{ type: 'FIXED', value: 200 }, { type: 'FLEX', value: 1 }, { type: 'FLEX', value: 2 }]; } catch (e) { threw = String(e); }
  if (!threw.includes('same length as the grid column count')) {
    fail('mock accepted sizes before count — the P2 ordering trap is unmeasurable');
  }
  f.gridColumnCount = 3;
  f.gridColumnSizes = [{ type: 'FIXED', value: 200 }, { type: 'FLEX', value: 1 }, { type: 'FLEX', value: 2 }];
  const a = m2.figma.createFrame();
  const b = m2.figma.createFrame();
  f.appendChild(a);
  f.appendChild(b); // auto-slots to (0,1) — adjacent
  threw = '';
  try { a.gridColumnSpan = 2; } catch (e) { threw = String(e); }
  if (!threw.includes('due to existing children in adjacent')) {
    fail('mock accepted a span over an occupied cell — the P3 occupancy throw is unmeasurable');
  }
  threw = '';
  try { a.gridChildHorizontalAlign = 'STRETCH'; } catch (e) { threw = String(e); }
  if (!threw.includes('Invalid enum value')) fail('mock accepted STRETCH align (P3 fence)');
  // P10: mode switch destroys tracks
  f.layoutMode = 'HORIZONTAL';
  if (f.gridColumnSizes.length !== 0) fail('mock preserved tracks across a mode switch (P10)');
}

// ---- 6. G7 refuses BY NAME at the schema -----------------------------------
const expectRefusal = (what: string, slug: string, parse: () => { success: boolean; error?: { issues: Array<{ message: string }> } }) => {
  const r = parse();
  if (r.success) fail(`${what}: ACCEPTED — must refuse by name (${slug})`);
  if (!r.error!.issues.some((i) => i.message.includes(slug))) {
    fail(`${what}: refused, but not BY NAME — wanted "${slug}", got ${JSON.stringify(r.error!.issues.map((i) => i.message))}`);
  }
};
const gridWithTrack = (t: unknown) => LayoutSchema.safeParse({ display: 'grid', rows: [t], columns: [{ fr: 1 }] });
expectRefusal('percent track', 'grid-track-percent', () => gridWithTrack('50%'));
expectRefusal('minmax track', 'grid-track-minmax', () => gridWithTrack({ min: 100, max: 300 }));
expectRefusal('auto-fit', 'grid-auto-fit-minmax', () => gridWithTrack('repeat(auto-fit, minmax(200px, 1fr))'));
expectRefusal('subgrid', 'grid-subgrid', () => gridWithTrack('subgrid'));
expectRefusal('zero px track', 'grid-track-zero', () => gridWithTrack({ px: 0 }));
expectRefusal('zero fr track', 'grid-track-zero', () => gridWithTrack({ fr: 0 }));
expectRefusal('dense flow', 'grid-flow-dense', () =>
  LayoutSchema.safeParse({ display: 'grid', columns: [{ fr: 1 }], flow: 'dense' }));
expectRefusal('column flow', 'grid-flow-column', () =>
  LayoutSchema.safeParse({ display: 'grid', columns: [{ fr: 1 }], flow: 'column' }));
expectRefusal('stretch align keyword', 'grid-align-stretch-keyword', () =>
  PartSchema.safeParse({ layout: { display: 'grid', rows: [{ px: 10 }], columns: [{ fr: 1 }] }, parts: { a: { placement: { row: 0, column: 0, alignX: 'stretch' } } } }));
expectRefusal('baseline align', 'grid-baseline-align', () =>
  PartSchema.safeParse({ layout: { display: 'grid', rows: [{ px: 10 }], columns: [{ fr: 1 }] }, parts: { a: { placement: { row: 0, column: 0, alignY: 'baseline' } } } }));
expectRefusal('negative line', 'grid-negative-line', () =>
  PartSchema.safeParse({ layout: { display: 'grid', rows: [{ px: 10 }], columns: [{ fr: 1 }] }, parts: { a: { placement: { row: -1, column: 0 } } } }));
expectRefusal('grow under grid', 'grid-child-grow', () =>
  PartSchema.safeParse({ layout: { display: 'grid', rows: [{ px: 10 }], columns: [{ fr: 1 }] }, parts: { a: { placement: { row: 0, column: 0 }, layout: { display: 'flex', grow: true } } } }));
// …and the two P3 canvas throws are refused CONTRACT-SIDE, before any emit:
expectRefusal('span beyond tracks', 'Column span exceeds grid column count', () =>
  PartSchema.safeParse({ layout: { display: 'grid', rows: [{ px: 10 }], columns: [{ fr: 1 }, { fr: 1 }] }, parts: { a: { placement: { row: 0, column: 0, columnSpan: 3 } } } }));
expectRefusal('occupancy overlap', 'overlap on the grid', () =>
  PartSchema.safeParse({ layout: { display: 'grid', rows: [{ px: 10 }, { fr: 1 }], columns: [{ fr: 1 }] }, parts: { a: { placement: { row: 0, column: 0, rowSpan: 2 } }, b: { placement: { row: 1, column: 0 } } } }));

console.log(
  'grid-bento ok: byte-deterministic ×2; every track/anchor/span/gap fact carried through the compiled ' +
    'spec AND the strict-mock readback (P8 geometry math exact); runtime text carries the probe-pinned ' +
    'order + the P9/P10 declaration guard; 14 G7/P3 constructs refused by name at the schema',
);
