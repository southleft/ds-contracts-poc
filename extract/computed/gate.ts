/**
 * COMPUTED-CAPTURE FLOOR — the fidelity gate (build-plan item 2).
 *
 * The adoption artifact: ENRICHED CONTRACT → core/emit-html → same pinned
 * browser → pixel + computed-equality against the ORIGINAL package's own
 * rendering, per variant × state, emitted as a machine-readable scorecard:
 *
 *   captured contract ──emit-html──▶ our render ──┐
 *                                                 ├─ same browser ─▶ diff
 *   original library (npm pkg) ──▶ their render ──┘   (captured truth +
 *                                                      original screenshots)
 *
 * Unlike the truth replay (replay.ts — vocabulary-INDEPENDENT), this gate
 * measures what today's contract vocabulary actually carries: every loss the
 * fusion named (overflow bindings, code-only channels, S3 residue) shows up
 * here as honest mismatch rows. Numbers are quoted at two fixed operating
 * points (exact / the AA point) and never widened.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright-core';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { emitHtml } from '../../core/emit-html.js';
import { walkAnatomy } from '../../scripts/contract-schema.js';
import { mintedTokenCss } from '../../core/mint-tokens.js';
import { tokenInventoryFromJson } from '../../core/tokens.js';
import { kebab } from '../types.js';
import type { Contract } from '../../scripts/contract-schema.js';
import type { CaptureConfig, ComponentConfig, PropSpace, Interaction } from './capture.js';
import { INTERACTIONS, stageFor } from './capture.js';
import { isFusable, type Capture, type Combo, type FlatEl } from './lib.js';
import type { AlignedSweep } from './fuse.js';

export interface GateRow {
  key: string; // `${combo}__${interaction}`
  channelsCompared: number;
  channelsEqual: number;
  pctExact: number;
  pctAA: number;
  mismatches: Array<{ part: string; channel: string; ours: string; theirs: string }>;
  note?: string;
}

export interface Scorecard {
  component: string;
  generatedBy: string;
  browser: string;
  method: string;
  combos: number;
  interactions: number;
  computed: {
    cellsCompared: number;
    cellsEqual: number;
    pctEqual: number;
    /** combo×state pairs with every compared channel equal. */
    rowsFullyEqual: number;
    rows: number;
  };
  pixel: {
    pairs: number;
    perfectExact: number;
    perfectAA: number;
    meanExact: number;
    meanAA: number;
    maxAA: number;
  };
  fusion: {
    boundConfirmed: number;
    boundCells: number;
    contradictions: number;
    mintedLeaves: number;
    mintedLeavesUnfolded: number;
    baseBindings: number;
    stateBindings: number;
    codeOnlyChannels: number;
    overflowBindings: number;
    folds: number;
  };
  worstRows: Array<{ key: string; pctAA: number; pctExact: number; channelsMismatched: number }>;
  topMismatchedChannels: Array<[string, number]>;
  namedLosses: string[];
  rows: GateRow[];
}

/** Combo prop values written in as defaults (the verify.ts trick): axis
 *  values (unset pseudo-values leave the prop defaultless — no override
 *  renders, the schema's own rule). */
function withComboAsDefaults(contract: Contract, space: PropSpace, combo: Combo, comp?: ComponentConfig): Contract {
  const clone = structuredClone(contract);
  // Round 4: the gate renders the CAPTURE-MOUNTED text samples (fixedProps /
  // sampleText) — comparing against the real render with different strings
  // would score the strings, not the styling.
  if (comp) {
    for (const prop of clone.props) {
      if (prop.type !== 'text') continue;
      const fixed = comp.fixedProps?.[prop.name];
      if (typeof fixed === 'string') prop.default = fixed;
      else if (prop.bindings.code.prop === 'children') prop.default = comp.sampleText;
    }
  }
  for (const a of space.axes) {
    const v = combo.axisValues[a.prop];
    const prop = clone.props.find((p) => p.name === a.prop);
    if (!prop) continue;
    // Round 4 presence axes: the enriched contract carries a BOOLEAN prop —
    // 'on'/'off' axis values become boolean defaults (the emitted static
    // HTML renders visibleWhen/stylesWhen off the boolean).
    if (prop.type === 'boolean') { prop.default = v === 'on'; continue; }
    if (a.unset !== undefined && v === a.unset) delete prop.default;
    else prop.default = v;
  }
  return clone;
}

export async function runGate(opts: {
  page: Page;
  repoRoot: string;
  cfg: CaptureConfig;
  comp: ComponentConfig;
  space: PropSpace;
  aligned: AlignedSweep;
  enriched: Contract;
  mintedTree: Record<string, unknown>;
  styled: Map<string, Set<string>>;
  origShotsDir: string;
  outDir: string;
  browserVersion: string;
  fusionCounts: Scorecard['fusion'];
  namedLosses: string[];
  /** Committed icon assets (config `icons` dir) — empty map when none. */
  iconAssets?: Map<string, string>;
  /** Round 4: the capture page's INHERITED text context (the control span's
   *  captured computed style) — the gate stage must recreate it (Polaris's
   *  AppProvider sets a 13px body; without it every inherited-only channel
   *  renders the UA default and the pixel diff scores the page chrome). */
  contextStyles?: Record<string, string>;
}): Promise<Scorecard> {
  const { page, repoRoot, cfg, comp, space, aligned, enriched, mintedTree, styled, origShotsDir, outDir } = opts;
  const iconAssets = opts.iconAssets ?? new Map<string, string>();
  const k = kebab(enriched.name);
  const tokensCss = readFileSync(path.join(repoRoot, cfg.tokens.css), 'utf8');
  const inventory = tokenInventoryFromJson([
    ...cfg.tokens.dtcg.map((p) => JSON.parse(readFileSync(path.join(repoRoot, p), 'utf8')) as Record<string, unknown>),
    mintedTree,
  ]);

  // CSS is combo-independent (defaults only affect HTML) — emit once.
  const contracts = new Map<string, Contract>([[enriched.id, enriched]]);
  const first = emitHtml(withComboAsDefaults(enriched, space, space.enumeration.combos[0], comp), {
    tokens: inventory,
    icons: iconAssets,
    contracts,
  });
  const stages: string[] = [];
  for (const combo of space.enumeration.combos) {
    const emitted =
      combo === space.enumeration.combos[0]
        ? first
        : emitHtml(withComboAsDefaults(enriched, space, combo, comp), { tokens: inventory, icons: iconAssets, contracts });
    stages.push(
      `<button data-sentinel="${combo.key}" style="width:8px;height:8px;padding:0;border:0;margin:2px;background:#eee" aria-label="sentinel"></button>
<div data-combo="${combo.key}" class="gate-stage">${emitted.html}</div>`,
    );
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
${tokensCss}
${mintedTokenCss(mintedTree)}
${first.css}
/* gate chrome (named): page font = the library's own sans token; the stage
   is byte-identical to the capture stage; the showcase chrome collapses via
   display:contents so the component root is the stage's flex item. */
html { color-scheme: ${cfg.browser.colorScheme}; font-family: var(--p-font-family-sans); }
body { margin: 0; background: #ddd; }
/* capture-page inherited context (round 4): the control span's captured
   computed text channels — same provenance as the capture stage. */
.gate-stage { ${['font-family', 'font-size', 'line-height', 'font-weight', 'letter-spacing', 'color']
    .filter((ch) => opts.contextStyles?.[ch])
    .map((ch) => `${ch}: ${opts.contextStyles![ch]};`)
    .join(' ')} }
.gate-stage { display: flex; align-items: flex-start; width: ${stageFor(cfg, comp).width}px; height: ${stageFor(cfg, comp).height}px; padding: ${stageFor(cfg, comp).padding}px; box-sizing: border-box; background: #fff; overflow: hidden; }
.gate-stage .showcase, .gate-stage .showcase__item:first-of-type { display: contents; font-family: inherit; }
.gate-stage .showcase__item:not(:first-of-type) { display: none; }
.gate-stage .showcase__label { display: none; }
</style></head><body>
${stages.join('\n')}
</body></html>`;
  const gatePage = path.join(outDir, 'gate.html');
  writeFileSync(gatePage, html);
  await page.goto(`file://${gatePage}`);
  await page.waitForSelector('[data-combo]', { timeout: 15_000 });
  await page.evaluate('document.fonts.ready');
  await page.waitForTimeout(200);

  // state-prop planes (disabled): set the DOM state on the emitted root so
  // the contract's :disabled CSS renders (states are CSS-driven; the emitted
  // static HTML has no prop surface for them).
  for (const combo of space.enumeration.combos) {
    for (const s of space.stateProps) {
      if (!combo.stateFlags[s.prop]) continue;
      if (s.state === 'disabled') {
        await page.evaluate(
          `(() => { const el = document.querySelector('[data-combo="${combo.key}"] .${k}'); if (el && 'disabled' in el) el.disabled = true; else if (el) el.setAttribute('data-gate-disabled-unsupported', ''); })()`,
        );
      }
    }
  }

  // Round 4: EVERY part the enriched contract carries (matched AND promoted)
  // scores — selectors on our side, aligned union index on theirs. Parts the
  // contract does not carry (promotion refusals, svg internals) stay out.
  const carriedParts = new Set(walkAnatomy(enriched).map((w) => w.name));
  const iconParts = new Set(walkAnatomy(enriched).filter((w) => w.part.icon).map((w) => w.name));
  const partSel = new Map<string, string>();
  const partIndex = new Map<string, number>();
  aligned.partNames.forEach((p, i) => {
    if (!carriedParts.has(p)) return;
    // icon parts render emitted svg markup — computed comparison against the
    // real <svg> element is not like-for-like (our wrapper is the part);
    // pixels judge glyphs.
    if (iconParts.has(p)) return;
    partSel.set(p, p === 'root' ? `.${k}` : `.${k}__${p}`);
    partIndex.set(p, i);
  });

  const gateShots = path.join(outDir, 'gate-shots');
  mkdirSync(gateShots, { recursive: true });

  const rows: GateRow[] = [];
  const mismatchByChannel = new Map<string, number>();
  for (const combo of space.enumeration.combos) {
    const stageSel = `[data-combo="${combo.key}"]`;
    const rootLoc = page.locator(`${stageSel} .${k}`).first();
    for (const interaction of INTERACTIONS) {
      await page.mouse.move(0, 0);
      await page.evaluate(`document.activeElement && document.activeElement.blur && document.activeElement.blur()`);
      await page.locator(stageSel).scrollIntoViewIfNeeded();
      let interactionNote: string | undefined;
      let mouseDown = false;
      try {
        if (interaction === 'hover') {
          await rootLoc.hover({ force: true, timeout: 5_000 });
        } else if (interaction === 'focus-visible') {
          await page.evaluate(`document.querySelector('[data-sentinel="${combo.key}"]').focus()`);
          await page.keyboard.press('Tab');
        } else if (interaction === 'active') {
          await rootLoc.hover({ force: true, timeout: 5_000 });
          await page.mouse.down();
          mouseDown = true;
        }
      } catch (e) {
        // e.g. a zero-area emitted root (width is a geometry channel the
        // vocabulary never carries — ProgressBar) cannot be hovered; the row
        // still scores, with the un-driven state, under a NAMED note.
        interactionNote = `interaction-driver-failed (${interaction}): ${String(e instanceof Error ? e.message : e).split('\n')[0].trim()}`;
      }
      await page.waitForTimeout(30);

      const key = `${combo.key}__${interaction}`;
      const truthCap = aligned.byKey.get(key);
      const row: GateRow = { key, channelsCompared: 0, channelsEqual: 0, pctExact: 100, pctAA: 100, mismatches: [] };
      if (interactionNote) row.note = interactionNote;
      if (!truthCap) {
        row.note = [row.note, 'no captured truth for this combo×state'].filter(Boolean).join('; ');
        rows.push(row);
        continue;
      }
      const truthEls = aligned.getAligned(key);
      for (const [part, sel] of partSel) {
        const idx = partIndex.get(part)!;
        const truthEl: FlatEl | null = truthEls[idx];
        if (!truthEl) continue;
        const channels = [...(styled.get(part) ?? [])].filter(isFusable).sort();
        if (channels.length === 0) continue;
        const ours = (await page.evaluate(
          `(() => { const el = document.querySelector('${stageSel} ${sel}'); if (!el) return null; const cs = getComputedStyle(el); const o = {}; for (const p of ${JSON.stringify(channels)}) o[p] = cs.getPropertyValue(p); return o; })()`,
        )) as Record<string, string> | null;
        if (!ours) {
          row.mismatches.push({ part, channel: '(selector)', ours: `MISSING ${sel}`, theirs: '' });
          row.channelsCompared += channels.length;
          continue;
        }
        for (const ch of channels) {
          row.channelsCompared++;
          const ourV = ours[ch].replace(/\brgb\((\d+), (\d+), (\d+)\)/g, 'rgba($1, $2, $3, 1)');
          const theirV = truthEl.node.style[ch];
          if (ourV === theirV) row.channelsEqual++;
          else {
            row.mismatches.push({ part, channel: ch, ours: ourV, theirs: theirV });
            mismatchByChannel.set(`${part}.${ch}`, (mismatchByChannel.get(`${part}.${ch}`) ?? 0) + 1);
          }
        }
      }

      // pixel vs the ORIGINAL screenshot of this combo×state
      const origPng = path.join(origShotsDir, `${comp.name}--${combo.key}__${interaction}.png`);
      if (existsSync(origPng)) {
        const shot = await page.locator(stageSel).screenshot({ timeout: 10_000 });
        writeFileSync(path.join(gateShots, `${combo.key}__${interaction}.png`), shot);
        const a = PNG.sync.read(readFileSync(origPng));
        const b = PNG.sync.read(shot);
        if (a.width !== b.width || a.height !== b.height) {
          row.pctExact = 100;
          row.pctAA = 100;
          row.note = [row.note, `size mismatch ours ${b.width}x${b.height} vs orig ${a.width}x${a.height}`].filter(Boolean).join('; ');
        } else {
          const total = a.width * a.height;
          const diffExact = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0, includeAA: true });
          const diffAA = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0.1 });
          row.pctExact = (100 * diffExact) / total;
          row.pctAA = (100 * diffAA) / total;
        }
      } else {
        row.note = [row.note, 'original screenshot unavailable — pixel not scored'].filter(Boolean).join('; ');
      }
      if (mouseDown) await page.mouse.up();
      rows.push(row);
    }
  }

  const cellsCompared = rows.reduce((n, r) => n + r.channelsCompared, 0);
  const cellsEqual = rows.reduce((n, r) => n + r.channelsEqual, 0);
  const scored = rows.filter((r) => !r.note?.startsWith('original screenshot'));
  const scorecard: Scorecard = {
    component: comp.name,
    generatedBy: 'extract/computed/gate.ts',
    browser: opts.browserVersion,
    method:
      'enriched contract → core/emit-html (wrapped library tokens + minted token custom properties) vs the ORIGINAL npm package rendering, same pinned Chromium, per combo × interaction; computed-equality over the styled channel set (exact string, no tolerance) + pixelmatch at threshold 0 (AA counted) and 0.1 (AA excluded) — both quoted, never widened',
    combos: space.enumeration.combos.length,
    interactions: INTERACTIONS.length,
    computed: {
      cellsCompared,
      cellsEqual,
      pctEqual: cellsCompared === 0 ? 100 : (100 * cellsEqual) / cellsCompared,
      rowsFullyEqual: rows.filter((r) => r.channelsCompared > 0 && r.channelsEqual === r.channelsCompared).length,
      rows: rows.length,
    },
    pixel: {
      pairs: scored.length,
      perfectExact: scored.filter((r) => r.pctExact === 0).length,
      perfectAA: scored.filter((r) => r.pctAA === 0).length,
      meanExact: scored.length === 0 ? 0 : scored.reduce((n, r) => n + r.pctExact, 0) / scored.length,
      meanAA: scored.length === 0 ? 0 : scored.reduce((n, r) => n + r.pctAA, 0) / scored.length,
      maxAA: scored.length === 0 ? 0 : Math.max(...scored.map((r) => r.pctAA)),
    },
    fusion: opts.fusionCounts,
    worstRows: [...rows]
      .sort((x, y) => y.pctAA - x.pctAA || y.pctExact - x.pctExact || y.mismatches.length - x.mismatches.length)
      .slice(0, 8)
      .map((r) => ({ key: r.key, pctAA: r.pctAA, pctExact: r.pctExact, channelsMismatched: r.mismatches.length })),
    topMismatchedChannels: [...mismatchByChannel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
    namedLosses: opts.namedLosses,
    rows,
  };
  return scorecard;
}
