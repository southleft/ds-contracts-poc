/**
 * Receipts for the PORTAL ROOT PICK — `npm run extract:computed:portal:check`.
 *
 * TWO MEASURED DEFECTS, both quoted from a falsifiable experiment that ran
 * flowbite-react@0.12.17's Modal through the DEFAULT capture recipe (2026-08-04,
 * task #20). The run exited 1 and wrote NO ARTIFACTS AT ALL.
 *
 * DEFECT 1 — THE CRASH. `portalSweep`'s beforeReset screenshot hook threw an
 * uncaught Playwright error out of the whole run:
 *
 *     locator.screenshot: Timeout 9987.447ms exceeded … 19 × waiting for
 *     element to be stable - element is not visible
 *
 * One un-shootable root killed a multi-component capture. A screenshot is
 * EVIDENCE, not a precondition: the computed-style capture, the anatomy and the
 * gate never depended on the PNG, and the pixel roll-ups already understand a
 * missing original (`no-original` — never a pair, excluded from the
 * denominator, never scored 100). The hook now degrades to that NAMED row.
 *
 * DEFECT 2 — THE WRAPPER. flowbite-react mounts overlays through
 * @floating-ui/react's `FloatingPortal`, which inserts an element between
 * document.body and the overlay — measured live as
 * `<div id="_r_2_" data-floating-ui-portal="">`, `position:static;
 * display:block`, rect {x:0, y:96, width:900, height:0} — ZERO AREA. The
 * single-root policy (`portaled.length === 1`) selected THAT as the captured
 * root, which is both why the screenshot could not be taken and why everything
 * downstream would have measured the wrapper instead of the dialog. MUI portals
 * its modal layer DIRECTLY to body, so no committed recipe had ever seen one.
 *
 * WHY THIS FILE IS A GATE AND NOT A DEMO. It drives the REAL exported
 * `portalSweep` against a page carrying BOTH shapes, plus the shape of every
 * committed portal corpus root reconstructed from its own captured-truth.json.
 * The unwrap must fire on the wrapper and must NOT fire on anything already
 * captured — including MUI's Tooltip popper, the genuine near miss (boxless,
 * exactly one element child, and kept only because it is `position:absolute`
 * with a 72.58×39 box: it really is doing the positioning).
 *
 * FALSIFICATION: revert either fix and this check fails — the crash fix by
 * throwing out of `portalSweep` (case B), the unwrap by capturing `fx-wrapper`
 * instead of `fx-dialog` (case A).
 *
 * Node shell over the real capture source. Reads the repo; writes only into a
 * scratch screenshot dir it creates and removes.
 */
import { chromium } from 'playwright-core';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { portalSweep, type ComponentConfig, type PropSpace } from './capture.js';
import type { CapturedNode } from './lib.js';
import { chromiumExecutable } from '../figma/visual-parity/render.js';

const failures: string[] = [];
const check = (label: string, cond: boolean): void => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

const REPO = path.resolve(path.join(import.meta.dirname, '..', '..'));
const OUT_ROOT = path.join(REPO, 'extract', 'computed', 'out');

// ---------------------------------------------------------------------------
// The two live shapes, plus the near miss and the un-shootable root.
// ---------------------------------------------------------------------------
/** THE FLOWBITE SHAPE: a `position:static; display:block` pass-through whose
 *  only element child is the fixed-position dialog — so the wrapper is
 *  ZERO-AREA exactly the way the live one was (900×0), because it is empty in
 *  flow, not because the fixture says `height:0`. */
const WRAPPER = `<div id="_r_2_" data-floating-ui-portal="" data-fx-mount>
  <div class="fx-dialog" role="dialog" aria-modal="true" style="position:fixed;top:96px;left:120px;width:400px;height:180px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 4px 8px rgba(0,0,0,.1)">
    <p class="fx-body" style="margin:16px">Dialog body</p>
  </div>
</div>`;

/** THE MUI SHAPE: the modal LAYER portaled DIRECTLY to body — `position:fixed;
 *  inset:0`, a visible scrim and a container beneath it. Two element children,
 *  so the wrapper rule cannot fire; the scrim-demotion rule (already committed)
 *  is the one that owns this shape. */
const DIRECT = `<div class="fx-layer" data-fx-mount style="position:fixed;top:0;right:0;bottom:0;left:0">
  <div class="fx-backdrop" style="position:fixed;top:0;right:0;bottom:0;left:0;background:rgba(0,0,0,.5)"></div>
  <div class="fx-container" style="position:static;display:flex;align-items:center;justify-content:center;height:100%">
    <div class="fx-paper" style="width:300px;height:120px;background:#fff">Paper</div>
  </div>
</div>`;

/** THE NEAR MISS (mui/tooltip, quoted from its committed captured-truth.json:
 *  `pos=absolute … h=39px w=72.5781px bg=rgba(0,0,0,0) … elkids=1`): boxless,
 *  exactly ONE element child — and NOT a wrapper, because it is positioned and
 *  has area. */
const NEAR_MISS = `<div class="fx-popper" data-fx-mount style="position:absolute;top:24px;left:24px">
  <div class="fx-tip" style="background:rgba(97,97,97,.92);width:52px;height:15px">tip</div>
</div>`;

/** AN UN-SHOOTABLE ROOT THAT THE UNWRAP CANNOT RESCUE: zero-area (both children
 *  are out of flow) but with TWO element children, so it is not a wrapper.
 *  Playwright's `element is not visible` — the live flowbite failure — with no
 *  root to descend to. */
const UNSHOOTABLE = `<div class="fx-ghost" data-fx-mount style="position:static;display:block">
  <span class="fx-a" style="position:fixed;width:0;height:0"></span>
  <span class="fx-b" style="position:fixed;width:0;height:0"></span>
</div>`;

// ---------------------------------------------------------------------------
// Every COMMITTED portal corpus root, reconstructed from its own artifact.
// The denominator is the corpora on disk, not a list typed here.
// ---------------------------------------------------------------------------
interface CorpusShape { key: string; html: string; tag: string; note: string }
const committedPortalShapes = (): CorpusShape[] => {
  const out: CorpusShape[] = [];
  if (!existsSync(OUT_ROOT)) return out;
  // `withFileTypes` and not a bare readdir: `out/` holds transient FILES
  // beside the corpus directories (regate.ts writes `.regate-probe.html`
  // there for the duration of a run), and a readdirSync on one of those
  // throws ENOTDIR — the gate died mid-run instead of reporting, which is a
  // gate that cannot be trusted to be the thing that reports.
  for (const lib of readdirSync(OUT_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
    const libDir = path.join(OUT_ROOT, lib);
    for (const comp of readdirSync(libDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
      const f = path.join(libDir, comp, 'captured-truth.json');
      if (!existsSync(f)) continue;
      const d = JSON.parse(readFileSync(f, 'utf8')) as {
        _provenance: unknown;
        base?: { key: string; root: CapturedNode };
      };
      if (!JSON.stringify(d._provenance).includes('portalCapture')) continue;
      if (!d.base) continue;
      const r = d.base.root;
      const s = r.style;
      const kids = r.nodes.filter((n) => n.t === 'el').length;
      // Only the properties the wrapper test MEASURES are reconstructed —
      // position/display/box/geometry/child count. Anything else would be
      // decoration on a test of exactly those.
      const style = [
        `position:${s['position']}`,
        `display:${s['display']}`,
        `width:${s['width']}`,
        `height:${s['height']}`,
        `background-color:${s['background-color']}`,
        `background-image:${s['background-image']}`,
        `border-top-width:${s['border-top-width']}`,
        `border-right-width:${s['border-right-width']}`,
        `border-bottom-width:${s['border-bottom-width']}`,
        `border-left-width:${s['border-left-width']}`,
        `border-style:solid`,
        `box-shadow:${s['box-shadow']}`,
        `top:0`,
        `left:0`,
      ].join(';');
      const children = Array.from({ length: kids }, (_, i) => `<span class="k${i}" style="display:block;width:8px;height:8px"></span>`).join('');
      out.push({
        key: `committed-${lib}-${comp}`,
        tag: r.tag,
        note: `${lib}/${comp} base root ${r.tag}|${r.classes.join('.')} — position:${s['position']}; ${s['width']}×${s['height']}; ${kids} element child(ren)`,
        html: `<${r.tag} class="fx-committed" data-fx-mount style="${style}">${children}</${r.tag}>`,
      });
    }
  }
  return out;
};

const corpusShapes = committedPortalShapes();
const SPECS: Array<{ key: string; html: string }> = [
  { key: 'wrapper', html: WRAPPER },
  { key: 'direct', html: DIRECT },
  { key: 'nearmiss', html: NEAR_MISS },
  { key: 'unshootable', html: UNSHOOTABLE },
  ...corpusShapes.map((c) => ({ key: c.key, html: c.html })),
];

/** The harness contract `capturePortalRoots` depends on: a `#depth-stage`
 *  present at baseline and a `window.__setSpec(false | index)` that mounts /
 *  unmounts one combo. Everything the sweep does — baseline diff, settle,
 *  blur, read, reset — runs unchanged over it. */
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#ddd;font:14px system-ui}</style>
</head><body>
<div id="depth-stage" style="width:320px;height:96px"></div>
<script>
  var SPECS = ${JSON.stringify(SPECS.map((s) => s.html))};
  window.__setSpec = function (v) {
    document.querySelectorAll('[data-fx-mount]').forEach(function (e) { e.remove(); });
    if (v === false || v === null || v === undefined) return;
    document.body.insertAdjacentHTML('beforeend', SPECS[v]);
  };
</script></body></html>`;

const comp = { name: 'Fixture' } as ComponentConfig;
const space = {
  enumeration: { combos: SPECS.map((s) => ({ key: s.key, axisValues: {}, stateFlags: {} })) },
} as unknown as PropSpace;

const shotsDir = mkdtempSync(path.join(os.tmpdir(), 'portal-wrapper-check-'));
const browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 1 });
await page.setContent(PAGE);
await page.evaluate(`(() => { window.__ALL_PROPS = [...getComputedStyle(document.documentElement)].sort(); return 1; })()`);

console.log(`portal root pick — ${SPECS.length} shapes (${corpusShapes.length} reconstructed from committed portal corpora)`);

// CASE B is asserted by the fact that this call RETURNS: the un-shootable combo
// is in the sweep, and before the fix its screenshot threw out of here.
let sweep: Awaited<ReturnType<typeof portalSweep>> | null = null;
let threw = '';
try {
  sweep = await portalSweep(page, comp, space, { screenshots: shotsDir });
} catch (e) {
  threw = e instanceof Error ? e.message : String(e);
}
check(`the sweep completes over an un-shootable root instead of throwing${threw ? ` — threw: ${threw.split('\n')[0]}` : ''}`, threw === '');

if (sweep) {
  const byCombo = new Map(sweep.captures.map((c) => [c.combo.replace(/^Fixture:/, ''), c.root]));
  const receipt = (prefix: string, key: string): string | undefined =>
    sweep!.receipts.find((r) => r.startsWith(`${prefix}: ${key} `));

  check(`every shape produced a capture (${byCombo.size}/${SPECS.length})`, byCombo.size === SPECS.length);

  // ---- (a) the unwrap fires on the wrapper … ----
  const wrapped = byCombo.get('wrapper');
  check('wrapper shape: the captured root is the DIALOG, not the zero-area wrapper', wrapped?.classes.join('.') === 'fx-dialog');
  check('wrapper shape: the captured root keeps role="dialog"', wrapped?.role === 'dialog');
  const wrapRec = receipt('portal-wrapper-unwrapped', 'wrapper');
  check('wrapper shape: the unwrap is RECEIPTED by name', !!wrapRec);
  check(
    'wrapper shape: the receipt names the MEASUREMENTS that decided it (position, display, geometry, child count)',
    !!wrapRec && /position:static/.test(wrapRec) && /display:block/.test(wrapRec) && /×0;/.test(wrapRec) && /1 element child/.test(wrapRec),
  );
  check('wrapper shape: the receipt reports the attribute it SAW (evidence) …', !!wrapRec && wrapRec.includes('data-floating-ui-portal'));
  const src = readFileSync(path.join(REPO, 'extract', 'computed', 'capture.ts'), 'utf8');
  const liveRule = src.slice(src.indexOf('const measureWrapper ='), src.indexOf('const rootInfo ='));
  check('… and the RULE itself contains no vendor attribute name', !/floating-ui|flowbite|mui|data-radix|headlessui/i.test(liveRule));
  const wrapperShot = path.join(shotsDir, 'Fixture--wrapper__default.png');
  check('wrapper shape: the unwrapped root IS shootable — the original PNG exists', existsSync(wrapperShot));

  // ---- … and NOT on the direct-to-body / near-miss / committed shapes ----
  check('direct-to-body (MUI) shape: NOT unwrapped', !receipt('portal-wrapper-unwrapped', 'direct'));
  check('direct-to-body (MUI) shape: the captured root is still the full-bleed layer', byCombo.get('direct')?.classes.join('.') === 'fx-layer');
  check('near-miss (boxless popper, one child, absolute, 52×15): NOT unwrapped', !receipt('portal-wrapper-unwrapped', 'nearmiss'));
  check('near-miss: the captured root is still the popper', byCombo.get('nearmiss')?.classes.join('.') === 'fx-popper');
  for (const c of corpusShapes) {
    check(`committed corpus shape NOT unwrapped — ${c.note}`, !receipt('portal-wrapper-unwrapped', c.key));
  }

  // ---- (b) an un-shootable root degrades to a NAMED row ----
  const ghostShot = path.join(shotsDir, 'Fixture--unshootable__default.png');
  check('un-shootable root: no original PNG was written (the row is a no-original row, not a fabricated score)', !existsSync(ghostShot));
  const shotRec = receipt('portal-screenshot-unavailable', 'unshootable');
  check('un-shootable root: the failure is RECEIPTED by name', !!shotRec);
  check('un-shootable root: the receipt quotes the real Playwright reason', !!shotRec && /element is not visible|Timeout/.test(shotRec));
  check('un-shootable root: its computed-style capture survived the failed screenshot', byCombo.get('unshootable')?.classes.join('.') === 'fx-ghost');
}

await browser.close();
rmSync(shotsDir, { recursive: true, force: true });

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} portal-root-pick check(s) failed:\n` + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`\n✔ portal root pick: unwrap fires on the zero-area wrapper, refuses ${corpusShapes.length + 2} already-captured shapes, and an un-shootable root is a named row rather than a dead run`);
