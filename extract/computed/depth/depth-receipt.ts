/**
 * DEPTH BUILD — Stage A+B receipt: Modal END-TO-END through the PRODUCTION
 * capture + anatomy modules (extract/computed/capture.ts + anatomy.ts), plus
 * the simple-set regression proof.
 *
 *   npx tsx extract/computed/depth/depth-receipt.ts --harness <dir>
 *
 * harness = an npm sandbox with @shopify/polaris@13.9.5 + react@18 +
 * react-dom@18 + esbuild installed (the depth-spike / computed-spike harness
 * convention). Needs the repo's pinned Chromium (visual-parity discovery).
 *
 * What it proves (the Stage A+B acceptance):
 *   A. Portal-aware capture — Modal is captured by the PRODUCTION baseline-diff
 *      reader (capture.capturePortalRoots): the dialog subtree portaled to
 *      document.body, with the current in-stage reader ABSENT. Double-run
 *      byte-identical.
 *   B. Multi-root anatomy — the PRODUCTION descent (anatomy.descendToRealRoots)
 *      + multi-root union/promotion (buildMultiRootUnion / promoteMultiRoot
 *      Anatomy) yields a real MULTI-ROOT anatomy {dialog, backdrop}. Numbers
 *      quoted vs the spike (extract/depth-spike/receipts/numbers.json).
 *   REGRESSION GUARD — Badge, Button, Checkbox: the multi-root path over their
 *      committed captured base root is BYTE-IDENTICAL to the single-root path
 *      (they root at an HTML element → descend zero wrappers). This is the
 *      acceptance that Stage A+B is additive.
 *
 * Receipts (committed, read by the evals — the evals never launch a browser):
 *   depth/receipts/modal.capture.json   — production portal capture (roots)
 *   depth/receipts/modal.anatomy.json   — promoted multi-root anatomy contract
 *   depth/receipts/modal.receipt.json   — numbers vs spike + regression proof
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright-core';
import { ContractSchema, type Contract } from '../../../scripts/contract-schema.js';
import {
  buildPortalHarnessPage,
  capturePortalRoots,
  loadConfig,
  propSpaceFor,
  type CaptureConfig,
  type ComponentConfig,
} from '../capture.js';
import {
  buildMultiRootUnion,
  buildUnion,
  descendToRealRoots,
  nameUnion,
  promoteAnatomy,
  promoteMultiRootAnatomy,
} from '../anatomy.js';
import { chromiumExecutable } from '../../figma/visual-parity/render.js';
import type { Capture, CapturedNode } from '../lib.js';
import { kebab } from '../../types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');
const OUT = path.join(HERE, 'receipts');
const CONFIG_PATH = path.join(REPO, 'extract/computed/configs/polaris-depth.json');
const SPIKE_NUMBERS = path.join(REPO, 'extract/depth-spike/receipts/numbers.json');

const harnessArg = process.argv.indexOf('--harness');
const HARNESS = harnessArg > -1 ? path.resolve(process.argv[harnessArg + 1]) : null;
if (!HARNESS || !existsSync(path.join(HARNESS, 'node_modules', '@shopify', 'polaris'))) {
  console.error('need --harness <dir> with @shopify/polaris@13.9.5, react@18, react-dom@18, esbuild installed');
  process.exit(1);
}
const HARNESS_DIR: string = HARNESS;

/** Reduce a captured base root to a single-combo Capture list keyed to a
 *  combo/interaction — the shape buildUnion/buildMultiRootUnion consume. */
const baseCombo = (root: CapturedNode, combo: string): Capture[] => [{ combo, interaction: 'default', root }];

async function main(): Promise<void> {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const cfg = loadConfig(REPO, CONFIG_PATH) as CaptureConfig;
  const modal = cfg.components.find((c) => c.name === 'Modal')!;
  const space = propSpaceFor(REPO, cfg, modal);
  const baseKey = `${space.baseComboKey}__default`;

  console.log('phase 1 — building portal harness page (esbuild over @shopify/polaris)…');
  const pageHtml = buildPortalHarnessPage(HARNESS_DIR, cfg, { comp: modal, space });

  const browser: Browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
  const context = await browser.newContext({
    viewport: cfg.browser.viewport,
    deviceScaleFactor: cfg.browser.deviceScaleFactor,
    colorScheme: cfg.browser.colorScheme,
  });
  const page = await context.newPage();
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 200)));
  await page.goto(`file://${pageHtml}`, { waitUntil: 'networkidle' });
  await page.evaluate('document.fonts.ready');
  await page.waitForTimeout(300);
  // the full longhand set the production read enumerates (sweep() sets this).
  await page.evaluate(`(() => { window.__ALL_PROPS = [...getComputedStyle(document.documentElement)].sort(); return window.__ALL_PROPS.length; })()`);
  console.log(`  browser ${browser.version()}`);

  // ---- Stage A: portal-aware capture (PRODUCTION capture.capturePortalRoots)
  console.log('\nphase 2 — Stage A: portal-aware capture (Modal)…');
  const cap1 = await capturePortalRoots(page, space.baseComboKey);
  const cap2 = await capturePortalRoots(page, space.baseComboKey);
  const determinism = JSON.stringify(cap1.roots) === JSON.stringify(cap2.roots);
  if (!determinism) throw new Error('portal capture NOT double-run byte-identical');
  const browserVersion = browser.version();
  await browser.close();

  const portaled = cap1.roots.filter((r) => r.location === 'portaled');
  const inStage = cap1.roots.filter((r) => r.location === 'in-stage');
  const portalBytes = portaled.reduce((n, r) => n + r.bytes, 0);
  console.log(`  new roots: ${cap1.roots.length} (${inStage.length} in-stage, ${portaled.length} portaled); portal DOM = ${portalBytes} bytes`);
  console.log(`  current in-stage reader (stage.firstElementChild): present=${cap1.currentReader.present} sig="${cap1.currentReader.sig}" descendantEls=${cap1.currentReader.descendantEls}`);
  writeFileSync(path.join(OUT, 'modal.capture.json'), JSON.stringify(cap1, null, 2) + '\n');

  // ---- Stage B: multi-root anatomy (PRODUCTION descent + union + promotion)
  console.log('\nphase 3 — Stage B: root-descending multi-root anatomy…');
  const realRoots = cap1.roots.flatMap((r) => descendToRealRoots(r.node));
  const multi = buildMultiRootUnion(
    [{ combo: space.baseComboKey, interaction: 'default', newRoots: cap1.roots.map((r) => r.node) }],
    baseKey,
    modal.name,
    cfg.library.classPrefix,
  );
  const promotion = promoteMultiRootAnatomy(space, modal, multi, kebab(space.contract.name));
  ContractSchema.parse(promotion.contract); // multi-root anatomy must be schema-valid (no schema change)
  console.log(`  real roots after descent: ${realRoots.length} — ${promotion.rootNames.join(', ')}`);
  console.log(`  promoted anatomy: ${promotion.partCount} parts, depth ${promotion.depth}, ${promotion.assets.size} asset(s), ${promotion.refusals.length} refusal(s)`);
  writeFileSync(path.join(OUT, 'modal.anatomy.json'), JSON.stringify(promotion.contract, null, 2) + '\n');

  // ---- REGRESSION GUARD: multi-root path == single-root path on the simple set
  console.log('\nphase 4 — regression guard: simple-set anatomy byte-identity…');
  const simpleCfg = loadConfig(REPO, path.join(REPO, 'extract/computed/configs/polaris.json'));
  const guard: Array<{ comp: string; realRootsIsRoot: boolean; anatomyIdentical: boolean }> = [];
  for (const name of ['Badge', 'Button', 'Checkbox']) {
    const sc = simpleCfg.components.find((c) => c.name === name)!;
    const ss = propSpaceFor(REPO, simpleCfg, sc);
    const truth = JSON.parse(
      readFileSync(path.join(REPO, 'extract/computed/out', name.toLowerCase(), 'captured-truth.json'), 'utf8'),
    ) as { base: { root: CapturedNode } };
    const root = truth.base.root;
    const ck = `${ss.baseComboKey}__default`;
    // descent is a no-op for an HTML-rooted component
    const rr = descendToRealRoots(root);
    const realRootsIsRoot = rr.length === 1 && rr[0] === root;
    // single-root path
    const uSingle = buildUnion(baseCombo(root, ss.baseComboKey), baseCombo(root, ss.baseComboKey)[0], simpleCfg.library.classPrefix);
    nameUnion(uSingle.entries, sc.name, simpleCfg.library.classPrefix);
    const single = promoteAnatomy(ss, sc, uSingle, kebab(ss.contract.name)).contract.anatomy;
    // multi-root path
    const m = buildMultiRootUnion(
      [{ combo: ss.baseComboKey, interaction: 'default', newRoots: [root] }],
      ck,
      sc.name,
      simpleCfg.library.classPrefix,
    );
    const multiA = promoteMultiRootAnatomy(ss, sc, m, kebab(ss.contract.name)).contract.anatomy;
    const anatomyIdentical = JSON.stringify(single) === JSON.stringify(multiA);
    guard.push({ comp: name, realRootsIsRoot, anatomyIdentical });
    console.log(`  ${name}: realRootsOf(root)==[root] ${realRootsIsRoot} · anatomy byte-identical ${anatomyIdentical}`);
    if (!realRootsIsRoot || !anatomyIdentical) throw new Error(`${name}: regression guard FAILED`);
  }

  // ---- receipt: numbers vs spike
  const spike = JSON.parse(readFileSync(SPIKE_NUMBERS, 'utf8')) as {
    specs: { modal: { m1: Record<string, unknown>; m2: Record<string, unknown> } };
  };
  const receipt = {
    generatedBy: 'extract/computed/depth/depth-receipt.ts',
    browser: browserVersion,
    note: 'Modal captured END-TO-END through the PRODUCTION capture + anatomy modules (portalCapture path). Numbers quoted against the spike (extract/depth-spike/receipts/numbers.json).',
    stageA_portalCapture: {
      production: {
        newRoots: cap1.roots.length,
        inStage: inStage.length,
        portaled: portaled.length,
        portalBytes,
        currentReader: cap1.currentReader,
        doubleRunByteIdentical: determinism,
      },
      spike: spike.specs.modal.m1,
    },
    stageB_multiRootAnatomy: {
      production: {
        realRoots: realRoots.length,
        rootNames: promotion.rootNames,
        parts: promotion.partCount,
        depth: promotion.depth,
        refusals: promotion.refusals,
      },
      spike: spike.specs.modal.m2,
    },
    regressionGuard: guard,
    pageErrors: [...new Set(pageErrors)],
  };
  writeFileSync(path.join(OUT, 'modal.receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`\nreceipts written to ${OUT}`);
  console.log(`  Stage A: 0 (current reader absent) → ${portalBytes}-byte portaled dialog captured (spike: ${(spike.specs.modal.m1 as { portalBytes: number }).portalBytes} B)`);
  console.log(`  Stage B: multi-root {${promotion.rootNames.join(', ')}}, ${promotion.partCount} parts depth ${promotion.depth} (spike: ${(spike.specs.modal.m2 as { realRoots: number; parts: number; maxDepth: number }).realRoots} roots, ${(spike.specs.modal.m2 as { parts: number }).parts} parts depth ${(spike.specs.modal.m2 as { maxDepth: number }).maxDepth})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
