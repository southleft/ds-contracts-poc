/**
 * THE DOOR CENSUS — how many facts the capture doors subtract, per library, and
 * how many of those subtractions leave a receipt.
 *
 *   npx tsx scripts/door-census.ts            # print the table
 *   npx tsx scripts/door-census.ts --json     # machine-readable
 *
 * WHAT IT MEASURES. Every committed `captured-truth.json` is RE-FUSED through
 * the live engine (no browser — the same offline replay `extract/computed/
 * regate.ts` and `extract/computed/ua-baseline-check.ts` use), and every receipt
 * the doors emit is collected and bucketed by its `<door-id>-…:` prefix. The
 * numbers below are therefore a measurement of THIS tree's engine against THIS
 * tree's corpus, never a stored claim.
 *
 * THE HONEST DENOMINATOR. `control-equal-drop` is the control-element delta
 * door (`fuse.control-element-delta`) — the largest subtraction in the pipeline
 * and, until this round, the only one with no receipt at all. Its count is
 * split two ways:
 *
 *   subtracted  every (part, channel) the door dropped because the value
 *               EQUALS the bare control for that part's tag. Most of these are
 *               genuine initial values; the count is here so the surface is
 *               never a silent zero again.
 *   authored    the subset the LIBRARY'S OWN STYLESHEET declares on that
 *               element (vrefs, or a var()-carrying shorthand via the capture
 *               ceiling). For these the door's premise is provably false: the
 *               control shares the value only because it is rendered inside the
 *               same page with the same global CSS, and the emitted CSS
 *               reproduces the component's rules and not the page's. THIS is
 *               the honest size of the "missing ink" surface.
 *
 * See spec/DOOR-REGISTER.md for the register these ids come from.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, propSpaceFor, stageFor, type CaptureConfig, type ComponentConfig, type SweepResult } from '../extract/computed/capture.js';
import { alignSweep, styledChannels, detectFolds, enrichLayout, prepareMint, uaStyles } from '../extract/computed/fuse.js';
import { promoteAnatomy } from '../extract/computed/anatomy.js';
import { reconstructCaptures, type CapturedTruthFile } from '../extract/computed/replay.js';
import { kebab } from '../extract/types.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CFG_DIR = path.join(REPO, 'extract/computed/configs');
/** Mirrors extract/computed/ua-baseline-check.ts — the same config→out map, so
 *  the two checks measure the same population. */
const OUT_FOR: Record<string, string> = {
  'polaris.json': 'extract/computed/out',
  'polaris-depth.json': 'extract/computed/out',
  'mui.json': 'extract/computed/out/mui',
  'carbon.json': 'extract/computed/out/carbon',
  'altitude.json': 'extract/computed/out/altitude',
  'astryx.json': 'extract/computed/out/astryx',
  'tailwind.json': 'extract/computed/out/tailwind',
  'fluent.json': 'extract/computed/out/fluent',
  'shadcn.json': 'extract/computed/out/shadcn',
  'antd.json': 'extract/computed/out/antd',
};

export interface LibraryCensus {
  library: string;
  components: number;
  /** control-element delta: (part, channel) pairs the door dropped. */
  controlEqualDrops: number;
  /** …of those, the ones the library's own stylesheet declares. */
  controlEqualAuthored: number;
  /** Parts whose tag has no control and were measured against <span>. */
  controlFallbackParts: number;
  /** Every OTHER door firing that left a receipt, bucketed by door prefix. */
  receiptedFirings: number;
  /** code-only / state-code-only entries (the structured residue channel). */
  codeOnly: number;
  byPrefix: Record<string, number>;
}

export interface Census {
  components: number;
  skipped: string[];
  libraries: LibraryCensus[];
  totals: Omit<LibraryCensus, 'library' | 'byPrefix'> & { byPrefix: Record<string, number> };
}

const PREFIX_RE = /^([a-z0-9-]+):/;

export function runCensus(): Census {
  const libraries: LibraryCensus[] = [];
  const skipped: string[] = [];
  let components = 0;

  for (const cfgFile of readdirSync(CFG_DIR).sort()) {
    if (!cfgFile.endsWith('.json')) continue;
    const cfg: CaptureConfig = loadConfig(REPO, path.join(CFG_DIR, cfgFile));
    const outRoot = path.join(REPO, OUT_FOR[cfgFile] ?? 'extract/computed/out');
    const libName = cfgFile.replace(/\.json$/, '');
    const row: LibraryCensus = {
      library: libName,
      components: 0,
      controlEqualDrops: 0,
      controlEqualAuthored: 0,
      controlFallbackParts: 0,
      receiptedFirings: 0,
      codeOnly: 0,
      byPrefix: {},
    };
    for (const comp of cfg.components as ComponentConfig[]) {
      const dir = path.join(outRoot, comp.name.toLowerCase());
      const truthPath = path.join(dir, 'captured-truth.json');
      if (!existsSync(truthPath)) continue;
      try {
        const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as CapturedTruthFile;
        const space = propSpaceFor(REPO, cfg, comp);
        const captures = reconstructCaptures(truth).map((c) => ({ ...c, combo: `${comp.name}:${c.combo}` }));
        const sweep = {
          captures,
          controls: truth.controls,
          allProps: truth._provenance.channels,
          stylesheetSkips: [],
          browserVersion: String(truth._provenance.browser ?? 'committed'),
          fontChecks: {},
          pinnedAnimations: [],
          shadowHostTrails: {},
          textFillFolds: {},
          closedShadowSuspects: {},
        } as unknown as SweepResult;
        const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix);
        const promotion = promoteAnatomy(space, comp, aligned.union, kebab(space.contract.name));
        const svgConsumed = new Set([...promotion.consumed].map((i) => aligned.partNames[i]));
        const controlStyles = Object.fromEntries(
          Object.entries(truth.controls).map(([t, n]) => [t, (n as { style: Record<string, string> }).style]),
        );
        const receipts: string[] = [];
        // THE UA BASELINE, not the in-page probe. `fuse.control-element-delta`
        // subtracts against the control measured on a page carrying NOTHING the
        // library ships; passing only `truth.controls` here would re-measure the
        // pre-fix fallback path and report a "missing ink" surface this engine no
        // longer has. Every other offline replay (regate, ua-baseline-check,
        // viewport-geometry-check, font-slant-check) passes the same argument.
        const styled = styledChannels(aligned, space, controlStyles, sweep.allProps, receipts, {
          viewport: cfg.browser.viewport,
          stage: stageFor(cfg, comp),
          portaled: comp.portalCapture === true,
        }, uaStyles(truth));
        const folds = detectFolds(aligned, styled, receipts);
        const layout = enrichLayout(aligned, space, styled, promotion.contract);
        const prep = prepareMint(
          aligned,
          comp,
          space,
          styled,
          folds,
          layout.handled,
          promotion.contract,
          svgConsumed,
          new Set(promotion.partIndex.keys()),
          promotion.gridMintRefusals,
        );
        receipts.push(...(prep.orphanRefusals ?? []), ...(prep.remintReceipts ?? []), ...(prep.inheritanceReceipts ?? []));

        row.components++;
        components++;
        for (const r of receipts) {
          const m = PREFIX_RE.exec(r);
          const prefix = m ? m[1] : 'unprefixed';
          row.byPrefix[prefix] = (row.byPrefix[prefix] ?? 0) + 1;
          if (prefix === 'control-equal-drop') {
            const n = /— (\d+) channel\(s\) EQUAL/.exec(r);
            if (n) row.controlEqualDrops += Number(n[1]);
          } else if (prefix === 'control-equal-drop-authored') {
            row.controlEqualAuthored++;
          } else if (prefix === 'control-fallback') {
            row.controlFallbackParts++;
          } else {
            row.receiptedFirings++;
          }
        }
        row.codeOnly += (prep.codeOnly?.length ?? 0) + (prep.stateCodeOnly?.length ?? 0);
      } catch (e) {
        skipped.push(`${cfgFile}/${comp.name}: ${(e as Error).message.slice(0, 120)}`);
      }
    }
    if (row.components > 0) libraries.push(row);
  }

  const totals = {
    components,
    controlEqualDrops: 0,
    controlEqualAuthored: 0,
    controlFallbackParts: 0,
    receiptedFirings: 0,
    codeOnly: 0,
    byPrefix: {} as Record<string, number>,
  };
  for (const l of libraries) {
    totals.controlEqualDrops += l.controlEqualDrops;
    totals.controlEqualAuthored += l.controlEqualAuthored;
    totals.controlFallbackParts += l.controlFallbackParts;
    totals.receiptedFirings += l.receiptedFirings;
    totals.codeOnly += l.codeOnly;
    for (const [k, v] of Object.entries(l.byPrefix)) totals.byPrefix[k] = (totals.byPrefix[k] ?? 0) + v;
  }
  return { components, skipped, libraries, totals: totals as Census['totals'] };
}

/** The markdown table the register and the PR body carry. */
export function censusTable(c: Census): string[] {
  const head = '| library | components | control-equal drops (silent until this round) | of those, LIBRARY-AUTHORED | span-fallback parts | other door firings (receipted) | code-only residue |';
  const sep = '|---|---:|---:|---:|---:|---:|---:|';
  const rows = c.libraries.map(
    (l) =>
      `| ${l.library} | ${l.components} | ${l.controlEqualDrops.toLocaleString('en-US')} | ${l.controlEqualAuthored} | ${l.controlFallbackParts} | ${l.receiptedFirings.toLocaleString('en-US')} | ${l.codeOnly.toLocaleString('en-US')} |`,
  );
  const t = c.totals;
  rows.push(
    `| **total** | **${t.components}** | **${t.controlEqualDrops.toLocaleString('en-US')}** | **${t.controlEqualAuthored}** | **${t.controlFallbackParts}** | **${t.receiptedFirings.toLocaleString('en-US')}** | **${t.codeOnly.toLocaleString('en-US')}** |`,
  );
  return [head, sep, ...rows];
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const c = runCensus();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(c, null, 2));
  } else {
    console.log(censusTable(c).join('\n'));
    console.log(`\nre-fused ${c.components} committed component(s), ${c.skipped.length} skipped`);
    for (const s of c.skipped.slice(0, 8)) console.log(`  ! ${s}`);
    const top = Object.entries(c.totals.byPrefix).sort((a, b) => b[1] - a[1]);
    console.log('\nreceipt firings by door prefix:');
    for (const [k, v] of top) console.log(`  ${String(v).padStart(6)}  ${k}`);
  }
}
