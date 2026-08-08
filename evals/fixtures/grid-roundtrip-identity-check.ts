/**
 * grid-roundtrip-identity eval body (A2 — the layout grammar's CLOSED LOOP).
 *
 * The other three grid evals each measure ONE leg:
 *   · grid-bento-carriage   contract → .figma.js → strict-mock readback
 *   · grid-css-emitters     contract → the three CSS surfaces
 *   · grid-code-proposer    CSS → contract
 * None of them closes the design loop, because none of them reads a CANVAS
 * back into a contract. This file does, and it does it without a hand-written
 * canvas fixture anywhere in the chain:
 *
 *     contract → emitFigmaScript → strict Figma mock (the real API's grid
 *     refusals) → the PLUGIN'S OWN dump script (figma-sync/plugin/ui.html
 *     #dump-source, the same bytes the plugin ships) → proposeFromDump
 *     → the contract again.
 *
 * Every stage is the shipping one. Hand-authoring the dump would prove what
 * this file BELIEVES the canvas holds; running the plugin's own reader over
 * the emitter's own output proves what it actually holds.
 *
 * WHAT THIS PINS
 *   1. IDENTITY — the P8 bento's layout block (3×4 declared tracks, both
 *      gaps) and all five placement rects (anchors + spans) come back
 *      byte-identical to the contract that produced the canvas.
 *   2. THE PIN CAN FAIL — red-tested twice by corrupting the recovered
 *      contract and by corrupting the CANVAS itself (a span rewritten on the
 *      node before the dump), so a silent identity claim cannot survive here.
 *   3. G4 — a NATIVE SLOT in a grid cell survives the read: its cell hoists
 *      back to layout.areas under the slot's name (the area name IS the slot
 *      anchor), while name-less sibling frames come back as explicit
 *      placements WITH the named receipt for the lost area names. Figma has
 *      no area-name storage, so that asymmetry is the grammar working, and
 *      it is NAMED rather than silent.
 *   4. G5 — a flow grid round-trips as flow: the emitter derives the row
 *      tracks (ceil(children/columns)), the canvas holds them, and the read
 *      returns `flow: "row"` with rows omitted and NO child placements.
 *
 * Exits non-zero with a named failure on any violated expectation.
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { emitFigmaScript } from '../../core/emit-figma-script.js';
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';
import { proposeFromDump } from '../../core/propose-figma.js';
import { tokenCorpusFromJson } from '../../core/token-corpus.js';

const fail = (msg: string): never => {
  console.error(`✘ grid-roundtrip-identity: ${msg}`);
  process.exit(1);
};
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

const TOKENS = { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } };
/** A real, well-formed corpus with empty trees — not a hand-shaped stub, so a
 *  missing field in TokenCorpus fails here the way it would in production. */
const corpus = tokenCorpusFromJson({ primitives: {}, semantic: {}, light: {}, brandDefault: {} });

const emit = (c: Contract): string =>
  emitFigmaScript(c, { tokens: TOKENS, icons: new Map(), contracts: new Map([[c.id, c]]) });

const runIn = async (mock: { figma: unknown }, script: string): Promise<unknown> => {
  const ctx = vm.createContext({ figma: mock.figma, console: { log() {}, warn() {}, error() {} } });
  return await vm.runInContext(`(async () => {\n${script}\n})()`, ctx, { timeout: 120_000 });
};

/** The dump EXACTLY as the plugin runs it — the ui.html #dump-source block
 *  (drift-guarded against extract/figma/dump.plugin.js), retargeted at one
 *  set. Same instrument discipline as native-slots-check.ts. */
const UI = readFileSync(path.join(process.cwd(), 'figma-sync/plugin/ui.html'), 'utf8');
const OPEN = '<script type="text/plain" id="dump-source">';
const START = UI.indexOf(OPEN);
if (START < 0) fail('figma-sync/plugin/ui.html carries no #dump-source block');
const dumpSource = (sets: string[]): string =>
  UI.slice(START + OPEN.length, UI.indexOf('</script>', START))
    .replace(/^\n/, '')
    .replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify(sets)};`);

interface Recovered {
  layout: Record<string, unknown> | undefined;
  parts: Record<string, Record<string, unknown>>;
  notes: string[];
}

/** contract → canvas → contract, through the shipping chain only.
 *  `mutateCanvas` runs against the BUILT node tree before the dump, which is
 *  how the canvas half of the loop gets red-tested. */
const roundTrip = async (
  contract: Contract,
  setName: string,
  mutateCanvas?: (mock: { root: { findAll(p: (n: never) => boolean): never[] } }) => void,
): Promise<Recovered> => {
  const mock = createFigmaMock() as unknown as { figma: unknown; root: { findAll(p: (n: never) => boolean): never[] } };
  await runIn(mock, emit(contract));
  if (mutateCanvas) mutateCanvas(mock);
  const dump = (await runIn(mock, dumpSource([setName]))) as Record<string, unknown>;
  const set = dump[setName];
  if (!set) fail(`the plugin dump captured no set named "${setName}" (keys: ${Object.keys(dump).join(', ')})`);
  const proposal = proposeFromDump(set as never, {
    corpus,
    contractIdByName: new Map<string, string>(),
  } as never) as { contract: { anatomy: { root: Record<string, unknown> } }; notes?: string[] };
  const root = proposal.contract.anatomy.root;
  return {
    layout: root.layout as Record<string, unknown> | undefined,
    parts: (root.parts ?? {}) as Record<string, Record<string, unknown>>,
    notes: proposal.notes ?? [],
  };
};

const eq = (a: unknown, b: unknown, what: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fail(`${what}\n    recovered: ${JSON.stringify(a)}\n    contract:  ${JSON.stringify(b)}`);
  }
};

// ---------------------------------------------------------------------------
// 1. IDENTITY — the P8 bento survives contract → canvas → contract
// ---------------------------------------------------------------------------
const BENTO_LAYOUT = {
  display: 'grid',
  rows: [{ px: 80 }, { fr: 1 }, { fr: 2 }],
  columns: [{ px: 160 }, { fr: 1 }, { fr: 1 }, { px: 120 }],
  gap: { row: 12, column: 16 },
} as const;
const BENTO_PLACEMENTS: Record<string, Record<string, number>> = {
  header: { row: 0, column: 0, columnSpan: 4 },
  sidebar: { row: 1, column: 0, rowSpan: 2 },
  main: { row: 1, column: 1, columnSpan: 2 },
  rail: { row: 1, column: 3, rowSpan: 2 },
  footer: { row: 2, column: 1, columnSpan: 2 },
};

const bento = (): Contract =>
  ContractSchema.parse({
    id: 'ds.eval-bento-rt',
    name: 'EvalBentoRt',
    version: '0.1.0',
    status: 'draft',
    description: 'grid-bento-span-matrix (P8) — the design round-trip identity pin',
    semantics: { element: 'div' },
    props: [],
    states: [],
    anatomy: {
      root: {
        layout: BENTO_LAYOUT,
        literals: { width: '640px', height: '480px' },
        parts: Object.fromEntries(
          Object.entries(BENTO_PLACEMENTS).map(([name, placement], i) => [
            name,
            { placement, literals: { 'background-color': ['#e0e0e0', '#d0d0d0', '#f0f0f0', '#c0c0c0', '#b0b0b0'][i] } },
          ]),
        ),
      },
    },
    anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'EvalBentoRt' } },
  }) as Contract;

console.log('\n1. IDENTITY — contract → canvas → contract, the shipping chain end to end');
{
  const r = await roundTrip(bento(), 'EvalBentoRt');
  eq(r.layout, BENTO_LAYOUT, 'the recovered layout block is not the contract that drew the canvas');
  for (const [name, placement] of Object.entries(BENTO_PLACEMENTS)) {
    const part = r.parts[name];
    if (!part) fail(`part "${name}" did not survive the round trip (recovered: ${Object.keys(r.parts).join(', ')})`);
    eq(part.placement, placement, `part "${name}" placement changed across the round trip`);
  }
  if (Object.keys(r.parts).length !== Object.keys(BENTO_PLACEMENTS).length) {
    fail(`the round trip returned ${Object.keys(r.parts).length} parts, the contract declared ${Object.keys(BENTO_PLACEMENTS).length}`);
  }
  ok(`the P8 bento is IDENTICAL after contract → emit → strict mock → plugin dump → propose (3×4 tracks, gaps 12/16, ${Object.keys(BENTO_PLACEMENTS).length} placement rects)`);
}

// ---------------------------------------------------------------------------
// 2. THE PIN CAN FAIL — red-tested on BOTH halves of the loop
// ---------------------------------------------------------------------------
console.log('\n2. RED TEST — an identity claim that cannot fail proves nothing');
{
  // (a) the COMPARISON must be able to see a one-px difference. eq() exits
  //     the process rather than throwing, so probe its predicate directly.
  if (JSON.stringify({ ...BENTO_LAYOUT, gap: { row: 12, column: 17 } }) === JSON.stringify(BENTO_LAYOUT)) {
    fail('the identity comparison cannot distinguish a changed gap — it would pass on anything');
  }
  ok('a one-px gap change is distinguishable by the comparison the identity check uses');

  // (b) corrupt the CANVAS: rewrite a span on the built node BEFORE the dump.
  //     The recovered contract must NOT match the source — proving the chain
  //     actually carries the canvas's facts rather than echoing the contract.
  const r = await roundTrip(bento(), 'EvalBentoRt', (mock) => {
    const nodes = mock.root.findAll(((n: { name: string }) => n.name === 'header') as never) as unknown as Array<{
      gridColumnSpan: number;
    }>;
    if (nodes.length === 0) fail('red test could not find the "header" node on the built canvas');
    nodes[0].gridColumnSpan = 3; // the contract says 4
  });
  const recovered = r.parts.header?.placement as Record<string, number> | undefined;
  if (!recovered) fail('red test: the "header" part vanished instead of changing');
  if (JSON.stringify(recovered) === JSON.stringify(BENTO_PLACEMENTS.header)) {
    fail(
      'THE ROUND TRIP IS NOT READING THE CANVAS: header\'s columnSpan was rewritten to 3 on the node and the ' +
        'proposal still returned the contract\'s 4 — the identity pin above would pass on a canvas that no longer matches',
    );
  }
  ok(`a span rewritten on the CANVAS changes the recovered contract (header columnSpan 4 → ${recovered.columnSpan ?? 1}) — the loop reads the canvas, not the contract`);
}

// ---------------------------------------------------------------------------
// 3. G4 — a native SLOT in a grid cell survives; the lost names are NAMED
// ---------------------------------------------------------------------------
console.log('\n3. G4 — named areas ARE slot anchors, and the canvas cannot store the other names');
{
  const shell = ContractSchema.parse({
    id: 'ds.eval-grid-shell-rt',
    name: 'EvalGridShellRt',
    version: '0.1.0',
    status: 'draft',
    description: 'G4 areas with a native slot in a grid cell — the area-name round trip',
    semantics: { element: 'div' },
    props: [],
    states: [],
    anatomy: {
      root: {
        layout: {
          display: 'grid',
          rows: [{ px: 64 }, { fr: 1 }],
          columns: [{ px: 240 }, { fr: 1 }],
          areas: {
            header: { row: 0, column: 0, columnSpan: 2 },
            nav: { row: 1, column: 0 },
            content: { row: 1, column: 1 },
          },
        },
        literals: { width: '640px', height: '400px' },
        parts: {
          header: { literals: { 'background-color': '#e0e0e0' } },
          nav: { literals: { 'background-color': '#d0d0d0' } },
          content: { slot: { name: 'content' } },
        },
      },
    },
    anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'EvalGridShellRt' } },
  }) as Contract;

  const r = await roundTrip(shell as Contract, 'EvalGridShellRt');
  const layout = r.layout ?? {};
  eq(layout.rows, [{ px: 64 }, { fr: 1 }], 'the shell grid lost its row tracks');
  eq(layout.columns, [{ px: 240 }, { fr: 1 }], 'the shell grid lost its column tracks');

  const areas = (layout.areas ?? {}) as Record<string, Record<string, number>>;
  const slotArea = Object.entries(areas)[0];
  if (!slotArea) {
    fail(
      `the native slot's cell did NOT hoist back to layout.areas — G4's "the area name IS the slot anchor" broke ` +
        `(recovered layout: ${JSON.stringify(layout)})`,
    );
  }
  eq(slotArea[1], { row: 1, column: 1 }, `the slot area "${slotArea[0]}" recovered the wrong rect`);
  const slotPart = r.parts[slotArea[0]];
  if (!slotPart?.slot) fail(`the recovered area name "${slotArea[0]}" is not a slot part — the anchor and the slot came apart`);
  if (slotPart.placement !== undefined) {
    fail(`slot part "${slotArea[0]}" carries BOTH an area rect and an explicit placement — declaring both is schema-invalid (G4: one source of truth)`);
  }
  ok(`the NATIVE SLOT in cell (1,1) survives the canvas and its rect hoists back to layout.areas["${slotArea[0]}"] — the slot is the one child that carries its own name on the canvas`);

  // The other two areas were name-less frames on the canvas, so they come back
  // as explicit placements. That loss is real and must be NAMED, never silent.
  eq(r.parts.header?.placement, { row: 0, column: 0, columnSpan: 2 }, 'the header area rect was lost, not lowered');
  eq(r.parts.nav?.placement, { row: 1, column: 0 }, 'the nav area rect was lost, not lowered');
  const named = r.notes.some((n) => /Figma has no native area names/.test(n) && /grid-area-nonrectangular/.test(n));
  if (!named) {
    fail(
      'the two non-slot areas came back as explicit placements with NO receipt — a contract that went out with ' +
        `layout.areas came back without them and nothing said so (notes: ${JSON.stringify(r.notes).slice(0, 400)})`,
    );
  }
  ok('the two name-less areas lower to explicit placement rects WITH the named receipt (grid-area-nonrectangular) — geometry kept, names named as lost');
}

// ---------------------------------------------------------------------------
// 4. G5 — a flow grid round-trips as flow, not as anchors
// ---------------------------------------------------------------------------
console.log('\n4. G5 — under flow the placement fact is CHILD ORDER, both ways');
{
  const gallery = ContractSchema.parse({
    id: 'ds.eval-grid-flow-rt',
    name: 'EvalGridFlowRt',
    version: '0.1.0',
    status: 'draft',
    description: 'G5 auto-flow round trip — rows omitted, derived by the emitter',
    semantics: { element: 'div' },
    props: [],
    states: [],
    anatomy: {
      root: {
        layout: { display: 'grid', columns: [{ fr: 1 }, { fr: 1 }, { fr: 1 }], flow: 'row', gap: { row: 8, column: 8 } },
        // G8: rows are OMITTED here, so the emitter derives {fr:1} tracks — an
        // fr axis needs a definite size, so the height is px, not fit-content
        // (`grid-hug-flex-axis` would refuse the pair).
        literals: { width: '480px', height: '240px' },
        parts: {
          a: { literals: { 'background-color': '#e0e0e0' } },
          b: { literals: { 'background-color': '#d0d0d0' } },
          c: { literals: { 'background-color': '#c0c0c0' } },
          d: { literals: { 'background-color': '#b0b0b0' } },
        },
      },
    },
    anchors: { figma: { fileKey: null, componentSetKey: null }, code: { importPath: 'x', export: 'EvalGridFlowRt' } },
  }) as Contract;

  const r = await roundTrip(gallery as Contract, 'EvalGridFlowRt');
  const layout = r.layout ?? {};
  if (layout.flow !== 'row') {
    fail(`a ROW_AUTO_FLOW canvas did not come back as flow "row" (recovered: ${JSON.stringify(layout)})`);
  }
  if (layout.rows !== undefined) {
    fail(
      `the flow grid came back carrying \`rows\` (${JSON.stringify(layout.rows)}) — G5 pins rows OMITTED under flow, ` +
        'because the emitter derives ceil(children/columns) itself and the API under-reports implicit rows (P9)',
    );
  }
  eq(layout.columns, [{ fr: 1 }, { fr: 1 }, { fr: 1 }], 'the flow grid lost its declared column tracks');
  const anchored = Object.entries(r.parts).filter(([, p]) => p.placement !== undefined).map(([n]) => n);
  if (anchored.length > 0) {
    fail(
      `flow grid children came back with explicit placements (${anchored.join(', ')}) — under ROW_AUTO_FLOW the ` +
        'placement fact is CHILD ORDER and the canvas refuses position setters entirely (P5)',
    );
  }
  ok(`4 children over 3 declared columns round-trip as flow "row" with rows omitted and NO anchors — the emitter's derived tracks stayed the emitter's`);
}

console.log(
  '\n✔ grid-roundtrip-identity ok: the P8 bento survives contract → canvas → contract byte-identically (red-tested on the canvas half), a native slot in a grid cell carries its area name home, the name-less areas lower with a receipt, and a flow grid returns as flow.',
);
