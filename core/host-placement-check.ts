/**
 * HOST-SECTION PLACEMENT GATE — `npm run host-placement:check`.
 *
 * WHY THIS EXISTS, precisely. Measured on the live scratch file 2026-08-26,
 * page `Census / altitude`: eight generated COMPONENT_SETs, five of their host
 * sections sitting at the IDENTICAL coordinate (100,100), drawn on top of one
 * another. The owner opened the file, saw three set titles superimposed
 * ("Badge (altitude.badge)" over "Button" over "IconClose") and a jumble of
 * dots, ×s and colour slivers, and concluded the conversion output was
 * garbage. It was not: Button and Link render correctly. They were BURIED.
 *
 * The cause was two hardcoded lines at the end of `ensureHostSection` in
 * core/emit-figma-script.ts — `section.x = 100; section.y = 100;` — run
 * UNCONDITIONALLY on create and on amend. So:
 *
 *   · a host section minted onto a page that already holds sections landed on
 *     top of them (no sibling awareness at all), and
 *   · a section a designer had dragged somewhere was TELEPORTED BACK to
 *     100,100 by the next re-mint.
 *
 * THE FOUR PINS BELOW ARE THE FALSIFIERS, not a description. Each one is RED
 * against the pre-fix emitter and GREEN after; P1/P2 fail with the exact
 * 100,100 collision the owner photographed.
 *
 *   P1 SEVERAL SETS, ONE PAGE — mint three contracts, gather them onto a
 *      single page as the census recipe does, re-mint; NO two host sections
 *      may overlap. RED before: three sections at 100,100.
 *   P2 THE DESIGNER'S POSITION SURVIVES — move one host section by hand,
 *      re-mint; it must still be exactly where it was left. RED before: back
 *      at 100,100.
 *   P3 DETERMINISM — the same corpus minted twice into two independent files
 *      must produce byte-identical section coordinates, or every census
 *      screenshot is noise.
 *   P4 THE PLACEMENT IS A COLUMN, NOT A COINCIDENCE — the sections come out
 *      ordered by the mint order with the declared gutter, so a person can
 *      predict where the next one lands. (P1 alone would pass a random
 *      scatter; P4 is the over-application guard.)
 *   P5 THE FIXED POINT — a set whose CONTENT is unchanged (its stored
 *      specHash still matches, so amendSet takes the "unchanged" early
 *      return) is STILL placed. Without this, re-running the sync can never
 *      repair a page: a set keeps whatever coordinate it already carries
 *      forever and only a human dragging things could fix it. That is the
 *      state the altitude page was in. RED before the ensureHostSection call
 *      was hoisted above the early return: zero host sections appear.
 *
 * NOT PINNED, and named rather than hidden: a host section that GROWS on
 * amend can grow into the gutter below it and touch its neighbour
 * (FC-HOST-SECTION-GROWTH). Preventing that means reflowing the neighbours,
 * and reflowing is exactly what breaks P2. The gutter is the mitigation, the
 * residual is real, and P2 is the promise that is worth more.
 *
 * The path is the proven offline one — buildEngineBundle (in-memory, the zip
 * is never written) → createFigmaMock → planGenerate over COMMITTED
 * contracts. No Figma, no network.
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { buildEngineBundle } from '../scripts/build-plugin-zip.mjs';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';

/** Three small committed contracts — enough to collide, cheap to build. */
const CONTRACTS = [
  'contracts/badge.contract.json',
  'contracts/kbd.contract.json',
  'contracts/code.contract.json',
];

const fail = (msg: string): never => {
  console.error(`\n✖ host-placement-check: ${msg}\n`);
  process.exit(1);
};
const assert = (cond: unknown, what: string): void => {
  if (!cond) fail(`pin failed: ${what}`);
};

const bundle = await buildEngineBundle();

type Section = { name: string; x: number; y: number; width: number; height: number; node: any };

const box = (s: Section) => ({ x1: s.x, y1: s.y, x2: s.x + s.width, y2: s.y + s.height });
const overlaps = (a: Section, b: Section): boolean => {
  const A = box(a);
  const B = box(b);
  return A.x1 < B.x2 && B.x1 < A.x2 && A.y1 < B.y2 && B.y1 < A.y2;
};

/** One isolated mock file with the engine loaded into it. */
const newFile = async () => {
  const { figma, root } = createFigmaMock() as { figma: any; root: any };
  const sandbox: Record<string, unknown> = {
    window: {},
    TextEncoder,
    TextDecoder,
    console: { log() {}, warn() {}, error() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(bundle.code, sandbox, { timeout: 120_000 });
  const DSC = (sandbox.window as { DSC: any }).DSC;
  assert(DSC && typeof DSC.planGenerate === 'function', 'window.DSC exposes the engine API');

  const scriptContext = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const runScript = (code: string) =>
    vm.runInContext(`(async () => {\n${code}\n})()`, scriptContext, { timeout: 120_000 });

  const contracts: unknown[] = [];
  for (const path of CONTRACTS) {
    const parsed = DSC.parseIncomingText(readFileSync(path, 'utf8'));
    assert(parsed.ok && parsed.kind === 'contract', `${path} parses as a contract document`);
    contracts.push(...parsed.contracts);
  }

  const mint = async () => {
    const plan = DSC.planGenerate(contracts, { withTokens: true, fileKey: '' });
    assert(plan.ok, 'the generate plan is accepted');
    for (const step of plan.steps) await runScript(step.code);
  };

  const sets = () =>
    root.findAll((n: any) => n.type === 'COMPONENT_SET' || n.type === 'COMPONENT').filter(
      (n: any) => n.getSharedPluginData('ds_contracts', 'contractId') && n.parent?.type !== 'COMPONENT_SET',
    );

  const sectionsOn = (page: any): Section[] =>
    page.children
      .filter((c: any) => c.type === 'SECTION' && c.getSharedPluginData('ds_contracts', 'hostFor'))
      .map((c: any) => ({ name: c.name, x: c.x, y: c.y, width: c.width, height: c.height, node: c }));

  return { figma, root, mint, sets, sectionsOn };
};

const report = (label: string, ss: Section[]) => {
  console.log(`  ${label}`);
  for (const s of ss)
    console.log(
      `    ${s.name.padEnd(28)} x=${Math.round(s.x)} y=${Math.round(s.y)} (${Math.round(s.width)}×${Math.round(s.height)})`,
    );
};

// ---------------------------------------------------------------------------
// P1 — SEVERAL SETS, ONE PAGE
//
// The census recipe gathers a library's sets onto one `Census / <library>`
// page. Reproduced here exactly: mint, move every set onto one page (dropping
// the per-component host sections, which is also the "legacy un-hosted set"
// state the emitter's own comment promises to adopt), clear the specHash so
// the amend body runs the way a runtime bump makes it run live, re-mint.
// ---------------------------------------------------------------------------
const f1 = await newFile();
await f1.mint();

const shared = f1.figma.createPage();
shared.name = 'Census / harness';
for (const set of f1.sets() as any[]) {
  const host = set.parent as any;
  shared.appendChild(set);
  if (host && host.type === 'SECTION') host.remove();
  set.setSharedPluginData('ds_contracts', 'specHash', '');
}
assert(f1.sectionsOn(shared).length === 0, 'the shared page starts with no host sections');
assert(shared.children.length === CONTRACTS.length, 'every set was gathered onto the shared page');

await f1.mint();
const laid = f1.sectionsOn(shared);
report('P1 host sections after the re-mint onto one page:', laid);
assert(laid.length === CONTRACTS.length, `all ${CONTRACTS.length} sets gained a host section on the shared page`);

for (let i = 0; i < laid.length; i++)
  for (let j = i + 1; j < laid.length; j++)
    assert(
      !overlaps(laid[i], laid[j]),
      `P1 host sections must not overlap — "${laid[i].name}" at (${laid[i].x},${laid[i].y}) ${laid[i].width}×${laid[i].height} ` +
        `collides with "${laid[j].name}" at (${laid[j].x},${laid[j].y}) ${laid[j].width}×${laid[j].height}`,
    );

// ---------------------------------------------------------------------------
// P2 — THE DESIGNER'S POSITION SURVIVES A RE-MINT
// ---------------------------------------------------------------------------
const moved = laid[0];
const MOVED_X = 4321;
const MOVED_Y = 8765;
moved.node.x = MOVED_X;
moved.node.y = MOVED_Y;
for (const set of f1.sets() as any[]) set.setSharedPluginData('ds_contracts', 'specHash', '');
await f1.mint();

const after = f1.sectionsOn(shared);
report('P2 host sections after moving one by hand and re-minting:', after);
const movedAfter = after.find((s) => s.node === moved.node);
assert(movedAfter, 'the hand-moved host section still exists after the re-mint');
assert(
  movedAfter!.x === MOVED_X && movedAfter!.y === MOVED_Y,
  `P2 a hand-moved host section must stay put — "${moved.name}" was left at (${MOVED_X},${MOVED_Y}) ` +
    `and came back at (${movedAfter!.x},${movedAfter!.y})`,
);
assert(
  after.length === CONTRACTS.length,
  'the re-mint did not mint duplicate host sections (identity marker still resolves)',
);

// ---------------------------------------------------------------------------
// P3 — DETERMINISM: the same corpus into two independent files
// ---------------------------------------------------------------------------
const coordsOf = async () => {
  const f = await newFile();
  await f.mint();
  const page = f.figma.createPage();
  page.name = 'Census / harness';
  for (const set of f.sets() as any[]) {
    const host = set.parent as any;
    page.appendChild(set);
    if (host && host.type === 'SECTION') host.remove();
    set.setSharedPluginData('ds_contracts', 'specHash', '');
  }
  await f.mint();
  return f.sectionsOn(page).map((s) => `${s.name}@${s.x},${s.y}`).join(' | ');
};
const runA = await coordsOf();
const runB = await coordsOf();
console.log(`  P3 run A: ${runA}`);
console.log(`  P3 run B: ${runB}`);
assert(runA === runB, `P3 two mints of the same corpus must land identically\n    A: ${runA}\n    B: ${runB}`);

// ---------------------------------------------------------------------------
// P4 — THE PLACEMENT IS A PREDICTABLE COLUMN
// ---------------------------------------------------------------------------
const GUTTER = 200;
const column = f1.sectionsOn(shared).filter((s) => s.node !== moved.node).sort((a, b) => a.y - b.y);
assert(column.length >= 2, 'P4 needs at least two column members to check the step');
for (const s of column) assert(s.x === 0, `P4 column members sit at x=0 — "${s.name}" is at x=${s.x}`);
for (let i = 1; i < column.length; i++) {
  const prev = column[i - 1];
  assert(
    column[i].y === prev.y + prev.height + GUTTER,
    `P4 "${column[i].name}" should follow "${prev.name}" by exactly the ${GUTTER}px gutter ` +
      `(expected y=${prev.y + prev.height + GUTTER}, got ${column[i].y})`,
  );
}

// ---------------------------------------------------------------------------
// P5 — THE FIXED POINT: an UNCHANGED set is still placed
//
// specHash is deliberately left INTACT here, so every set takes amendSet's
// "unchanged" early return. Placement must happen anyway, or re-running the
// sync is powerless to repair a page that is already wrong.
// ---------------------------------------------------------------------------
const f5 = await newFile();
await f5.mint();
const unchangedPage = f5.figma.createPage();
unchangedPage.name = 'Census / unchanged';
for (const set of f5.sets() as any[]) {
  const host = set.parent as any;
  unchangedPage.appendChild(set);
  if (host && host.type === 'SECTION') host.remove();
}
await f5.mint();
const converged = f5.sectionsOn(unchangedPage);
report('P5 host sections after re-minting sets whose specHash is UNCHANGED:', converged);
assert(
  converged.length === CONTRACTS.length,
  `P5 an unchanged set must still be placed — expected ${CONTRACTS.length} host sections on the shared page, found ${converged.length}`,
);
for (let i = 0; i < converged.length; i++)
  for (let j = i + 1; j < converged.length; j++)
    assert(
      !overlaps(converged[i], converged[j]),
      `P5 "${converged[i].name}" collides with "${converged[j].name}" on the unchanged path`,
    );

console.log(
  `\n✔ host-placement-check: P1 ${CONTRACTS.length} sets on one page, no overlap · P2 a hand-moved section survives a re-mint · ` +
    `P3 two mints land identically · P4 the column steps by ${GUTTER}px · P5 an unchanged set is still placed\n`,
);
