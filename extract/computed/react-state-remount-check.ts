/**
 * REACT-STATE REMOUNT CHECK — `npm run extract:computed:remount:check`.
 *
 * WHAT BROKE (F1 / react-day-picker, 2026-08-31). Double-run byte-identity
 * refused: `td|rdp-day` vs `td|rdp-day.rdp-selected` moved between structural
 * indices across two sweeps of the same combo (`Calendar:label.1__default`).
 * The held-out `classAllow` was not the bug — it honestly keeps `rdp-selected`
 * as identity. The leak: sweep 1's `active` plane does hover + mouse.down,
 * then mouse.up (a real click). formStateReset walks `<input>` checked/value
 * only. A React calendar's `selected` is invisible to that walk, so sweep 2's
 * `__default` read a different selected cell.
 *
 * WHY THIS FILE IS NOT A TAUTOLOGY. It drives the REAL exported `sweep()`
 * against a seven-cell grid whose click handler moves a `sel` class the same
 * way `rdp-selected` moves. `classAllow` keeps `sel` as identity, on purpose.
 * Two assertions:
 *
 *   1. LEAK — the active driver's mouse.up WITHOUT remount moves `sel` off
 *      the pinned cell (the day-picker witness, reproduced).
 *   2. FIX — two full `sweep()` calls on the same page are byte-identical,
 *      because sweep remounts the combo from mount props before each plane.
 *
 * FALSIFICATION: delete the `remountHarness(page, key)` call in sweep() and
 * assertion 2 fails (sweep 2 `__default` sees the clicked cell). Tighten
 * `classAllow` to drop `sel` and assertion 1's signature witness disappears
 * while the STYLE channels (background, font-weight) still move — the reason
 * a floor denylist of "state classes" is not the fix.
 *
 * Chromium required (playwright-core). Writes only into a temp dir it removes.
 */
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright-core';
import { chromiumExecutable } from '../figma/visual-parity/render.js';
import {
  captureJs,
  controlBoxesHtml,
  remountHarness,
  sweep,
  type ComponentConfig,
  type PropSpace,
} from './capture.js';
import { flatten, type CapturedNode } from './lib.js';

const failures: string[] = [];
const check = (label: string, cond: boolean, detail = ''): void => {
  if (!cond) failures.push(label + (detail ? ` — ${detail}` : ''));
  console.log(`  ${cond ? '✔' : '✖'} ${label}${cond || !detail ? '' : ` — ${detail}`}`);
};

const STAGE = { width: 320, height: 80, padding: 8 };
const CLASS_ALLOW = '^(grid|cell|sel)$';
const COMBO = 'Grid:base';

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>
  body { margin: 0; background: #ddd; }
  .grid { display: flex; width: 280px; height: 40px; }
  .cell { flex: 1; height: 40px; border: 1px solid #ccc; background: #fff; font: 14px/40px sans-serif; padding: 0; }
  .cell.sel { background: #111; color: #fff; font-weight: 700; }
</style>
</head><body>
<button data-sentinel="${COMBO}" style="width:8px;height:8px;padding:0;border:0;margin:2px;background:#eee" aria-label="sentinel"></button>
<div data-combo="${COMBO}" style="display:flex;align-items:flex-start;width:${STAGE.width}px;height:${STAGE.height}px;padding:${STAGE.padding}px;box-sizing:border-box;background:#fff;overflow:hidden">
  <div class="grid" id="grid">
    <button class="cell sel" type="button">1</button>
    <button class="cell" type="button">2</button>
    <button class="cell" type="button">3</button>
    <button class="cell" type="button">4</button>
    <button class="cell" type="button">5</button>
    <button class="cell" type="button">6</button>
    <button class="cell" type="button">7</button>
  </div>
</div>
${controlBoxesHtml(STAGE, '__control-')}
<script>
document.addEventListener('click', (e) => e.preventDefault(), true);
const grid = document.getElementById('grid');
const pinSel = () => {
  [...grid.querySelectorAll('.cell')].forEach((c, i) => c.classList.toggle('sel', i === 0));
};
grid.addEventListener('click', (e) => {
  const cell = e.target && e.target.closest && e.target.closest('.cell');
  if (!cell || !grid.contains(cell)) return;
  [...grid.querySelectorAll('.cell')].forEach((c) => c.classList.remove('sel'));
  cell.classList.add('sel');
});
window.__DSC_REMOUNT = () => { pinSel(); };
</script>
</body></html>`;

const mounts = [
  {
    comp: { name: 'Grid' } as ComponentConfig,
    space: {
      enumeration: {
        policy: 'full-cartesian' as const,
        cartesianSize: 1,
        combos: [{ key: 'base', axisValues: {}, stateFlags: {} }],
        receipts: [],
      },
    } as unknown as PropSpace,
  },
];

const selSigs = (root: CapturedNode): string[] =>
  flatten(root, '')
    .filter((e) => e.node.classes.includes('cell'))
    .map((e) => `${e.path}:${e.sig}`);

const tmp = mkdtempSync(path.join(os.tmpdir(), 'react-state-remount-'));
const htmlPath = path.join(tmp, 'index.html');
writeFileSync(htmlPath, PAGE);

const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const context = await browser.newContext({ viewport: { width: 400, height: 240 }, deviceScaleFactor: 1, colorScheme: 'light' });
const page = await context.newPage();
await page.goto(`file://${htmlPath}`);
await page.waitForSelector(`[data-combo="${COMBO}"]`);
await page.evaluate(`(() => { window.__ALL_PROPS = [...getComputedStyle(document.documentElement)].sort(); return 1; })()`);

console.log('react-state remount — repeating-cell click leak vs clean remount');

const readRoot = async (): Promise<CapturedNode> => {
  const raw = (await page.evaluate(captureJs(`[data-combo="${COMBO}"]`, CLASS_ALLOW))) as CapturedNode | null;
  if (!raw) throw new Error('capture failed');
  return raw;
};

const before = selSigs(await readRoot());
const rootLoc = page.locator(`[data-combo="${COMBO}"] > *`).first();
await rootLoc.hover({ force: true });
await page.mouse.down();
await page.mouse.up();
const afterClick = selSigs(await readRoot());
check(
  'LEAK: active mouse.up without remount moves `sel` to a different repeating cell',
  JSON.stringify(before) !== JSON.stringify(afterClick),
  `before=${before.join(',')} after=${afterClick.join(',')}`,
);
check(
  'LEAK witness is the selected-class signature (cell vs cell.sel), not a missing classAllow',
  afterClick.some((s) => s.endsWith(':button|cell.sel')) && before.some((s) => s.endsWith(':button|cell.sel')),
);

const remounted = await remountHarness(page);
check('remountHarness finds window.__DSC_REMOUNT on the fixture page', remounted);
const afterRemount = selSigs(await readRoot());
check(
  'REMOUNT: the pinned cell is restored (sel back on the first cell)',
  JSON.stringify(afterRemount) === JSON.stringify(before),
  `want=${before.join(',')} got=${afterRemount.join(',')}`,
);

const sweepOpts = {
  fontProbes: ['-apple-system'],
  classAllow: CLASS_ALLOW,
  uaBaseline: { stage: STAGE, colorScheme: 'light' },
};
const run1 = await sweep(page, mounts, sweepOpts);
const run2 = await sweep(page, mounts, sweepOpts);
const canon = (r: typeof run1) => JSON.stringify({ captures: r.captures.map((c) => ({ combo: c.combo, interaction: c.interaction, root: c.root })) });
check(
  'FIX: two sweep() calls on the same page are byte-identical (remount-before-each-plane)',
  canon(run1) === canon(run2),
);
const def1 = run1.captures.find((c) => c.interaction === 'default');
const def2 = run2.captures.find((c) => c.interaction === 'default');
check('FIX: both `__default` captures still carry `sel` as a FACT on the pinned cell', !!def1 && !!def2 && selSigs(def1.root).some((s) => s.endsWith(':button|cell.sel')));
check(
  'FIX: the pinned selected signature did not shuffle structural indices',
  !!def1 && !!def2 && JSON.stringify(selSigs(def1.root)) === JSON.stringify(selSigs(def2.root)),
);

const src = (await import('node:fs')).readFileSync(new URL('./lib.ts', import.meta.url), 'utf8');
check(
  'the floor names why state classes stay in signatures (no corpus-wide denylist)',
  src.includes('NOT a floor denylist'),
);

await browser.close();
rmSync(tmp, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} react-state-remount check(s) failed:\n` + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('\n✔ react-state remount: leak reproduced, remount restores, double-sweep identical');
