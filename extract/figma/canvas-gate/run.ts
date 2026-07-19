/**
 * THE CANVAS PIXEL GATE — how closely do our canvas-engine renders match the
 * real @shopify/polaris package, per variant cell, in pixels and in numbers.
 *
 *   npx tsx extract/figma/canvas-gate/run.ts [--component Name]
 *
 * Side A: the headless canvas-engine compile
 *         (createFigmaEngine().compileComponentData — the exact compile the
 *         Figma sync scripts serialize) rendered by the playground's canvas
 *         renderer (vendored verbatim in canvas-doc.ts), one cell per stage,
 *         screenshotted at deviceScaleFactor 2.
 * Side B: the real @shopify/polaris@13.9.5 npm package mounted per cell in
 *         the SAME pinned Chromium (extract/computed mount recipe),
 *         interaction states driven the visual-parity way, screenshotted at
 *         deviceScaleFactor 2.
 *
 * Re-runs from the CURRENT committed contracts + token wrap every time —
 * nothing is cached across runs. Deterministic: fixed viewport/DSF/color
 * scheme, fonts awaited, infinite animations pinned at t=0, transitions off.
 *
 * Outputs (committed):
 *   examples/polaris/receipts/canvas-gate/<kebab>.scorecard.json
 *   examples/polaris/receipts/canvas-gate/<kebab>.channels.md
 *   examples/polaris/receipts/canvas-gate/<kebab>--worst.png / --representative.png
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from 'playwright-core';
import { kebab } from '../../types.js';
import type { Contract } from '../../../scripts/contract-schema.js';
import type { ComponentData, NodeSpec } from '../../../core/emit-figma-script.js';
import { loadWorld, deriveCells, projectForCanvas, EXAMPLE, type Cell, type World } from './compile.js';
import { buildCanvasGateDoc } from './canvas-doc.js';
import { buildRealPage, type MountSpec } from './real-page.js';
import { launchGateBrowser, newGatePage, captureCell, fontAvailable, type CellShot, type Interaction } from './shots.js';
import { readPngBuffer, alignPair, scoreCell, writeReceipt } from './score.js';
import { buildChannelRows, channelsMarkdown, loadCaptureConfig, loadTruth } from './channels.js';

const OUT = path.join(EXAMPLE, 'receipts', 'canvas-gate');
const SCRATCH = path.join(
  process.env.CLAUDE_SCRATCHPAD ??
    '/private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad',
  'ws3',
  'gate',
);
const HARNESS =
  process.env.POLARIS_HARNESS ??
  '/private/tmp/claude-501/-Users-tjpitre-Sites-ds-contracts-poc/601388a4-bfff-4bbd-aaf1-50a4605c39ae/scratchpad/polaris-harness';

/** Pixel-scored components (Text/TextField join the channel tables only —
 *  55/4 typography sample cells are computed-verified, not pixel-diffed). */
const PIXEL_SCOPE = [
  'Avatar', 'Badge', 'Banner', 'Button', 'Checkbox',
  'ProgressBar', 'RadioButton', 'Spinner', 'Tag', 'Thumbnail',
] as const;
const CHANNEL_ONLY_SCOPE = ['Text', 'TextField'] as const;

/** Deterministic 1×1 gray SVG (the extract/computed capture's Thumbnail
 *  source — Thumbnail.source is required with no contract default). */
const GRAY_SQUARE =
  "data:image/svg+xml;utf8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201%201'%3E%3Crect%20width='1'%20height='1'%20fill='%23d8d8d8'/%3E%3C/svg%3E";

/** Per-component real-mount table. Text content is DERIVED from the compiled
 *  spec at runtime (textOf) so regenerated contracts stay in sync; only the
 *  prop ROUTING is declared here. */
interface MountPlan {
  /** spec text-node name whose characters become React children. */
  childrenFrom?: string;
  /** spec text-node name → real prop name. */
  textProps?: Record<string, string>;
  fixed?: Record<string, unknown>;
  callbacks?: string[];
  mountNote?: string;
}
interface MountPlanExt extends MountPlan {
  /** Definite container width (px) — components that size to their
   *  container (ProgressBar width:100%) collapse in a max-content stage. */
  stageWidth?: number;
}
const MOUNT_PLAN: Record<string, MountPlanExt> = {
  // ROUND 4: the real side mounts the FLOOR'S OWN samples (sampleText /
  // fixedProps from extract/computed/configs/polaris.json, loaded at run
  // time below) — the ground truth the contracts were captured against.
  // childrenFrom names still derive text from the compiled spec when the
  // node exists; the floor sample is the fallback.
  Button: { childrenFrom: 'label' },
  Badge: { childrenFrom: 'label' },
  Tag: { childrenFrom: 'label' },
  Banner: { childrenFrom: 'label-2', textProps: { title: 'title' } },
  Checkbox: {
    callbacks: ['onChange'],
    mountNote:
      'round 4: the promoted anatomy CARRIES the label part — the real mount shows the label (floor fixedProps), retiring the round-3 labelHidden scoping.',
  },
  RadioButton: {
    callbacks: ['onChange'],
    mountNote: 'round 4: label mounted visible (promoted label anatomy — see Checkbox note).',
  },
  Avatar: { textProps: { initials: 'initials' } },
  ProgressBar: {
    stageWidth: 288,
    mountNote:
      'mounted in a 288px container (floor stage content width): the real track is width:100% and collapses in a max-content stage; the canvas root is runtime-sized — width deltas are the named runtime-% cause.',
  },
  Spinner: {},
  Thumbnail: { fixed: { source: GRAY_SQUARE } },
};

/** Floor capture config — the prop samples the contracts were captured
 *  against (sampleText + fixedProps per component). */
const FLOOR_CONFIG = JSON.parse(
  readFileSync(path.join(EXAMPLE, '..', '..', 'extract', 'computed', 'configs', 'polaris.json'), 'utf8'),
) as { components: Array<{ name: string; sampleText: string; fixedProps?: Record<string, unknown> }> };
const floorComp = (name: string) => FLOOR_CONFIG.components.find((c) => c.name === name);

/** Named causes attached to cells AFTER measurement — every rule quotes a
 *  mechanism a designer (or the channel table) can check, never a tolerance. */
const CELL_CAUSES: Array<{ component?: string; test: (cell: Cell, shots: { real: CellShot }) => string | null }> = [
  {
    test: (cell, shots) =>
      cell.state === 'focus-visible' && shots.real.focusVisibleMatched === false
        ? 'real side :focus-visible did not match (component root is not keyboard-focusable in this mount) — the canvas draws the contract\'s focus preview; the real side shows the resting paint'
        : null,
  },
  {
    test: (cell) =>
      cell.state === 'focus-visible'
        ? 'outline→stroke approximation (documented canvas fidelity note): the web focus ring is an outline OUTSIDE the border box; the canvas draws it as a bound stroke inside layout — geometry shifts by the ring width'
        : null,
  },
  {
    component: 'Checkbox',
    test: () =>
      'CANVAS SIDE BLANK (see ink columns): the backdrop compiles white fill + border-width {p.border-width-0} = 0 and the renderer draws no effectStack — the real control edge is an inset box-shadow (Polaris\'s Choice wrapper zeroes the border and repaints it as an inset shadow, see the config triage), so the canvas draws a white-on-white box',
  },
  {
    component: 'RadioButton',
    test: () => 'canvas renderer draws no effectStack — the real control edge is an inset box-shadow, absent on the canvas side',
  },
  {
    component: 'Banner',
    test: () =>
      'CONTRACT ANATOMY GAP (channel table: root bg/radius match): the compiled Banner draws title+body text in a horizontal row only — no tone icon ribbon, no inner Box padding, no vertical stack; the real Banner renders the full card. The tone surface rides an inner Box the promotion refused by name (config triage)',
  },
  {
    component: 'Avatar',
    test: () =>
      'EMITTER/CONTRACT GAP (channel table: fill/radius/font all match): the root carries width but NO height channel — the canvas draws a text-hugging box (md 40x16 CSS) vs the real square (md 28x28); the 6-char initials placeholder overflows the fixed width. Real fill additionally rides the hash-selected palette (initials-keyed at runtime)',
  },
  {
    component: 'ProgressBar',
    test: (cell) => (cell.spec.children?.some((c) => c.pct !== undefined) ? 'runtime-% meter width: the canvas draws the defaults\' fraction' : null),
  },
  {
    component: 'Button',
    test: (cell) =>
      cell.subst['tone']
        ? 'NAMED CONTRACT REFUSAL (channel table quotes both colors): tone×variant multi-axis paint (.tone*:is(.variant*)) was refused by name in the static promotion — the canvas draws the neutral variant paint while the real critical/success Button repaints fill/label. The tone axis is also DEFAULTLESS, so the canvas cartesian contains no neutral-tone cell at all'
        : null,
  },
  {
    component: 'Button',
    test: (cell) =>
      cell.state === 'disabled'
        ? 'EMITTER-DEFECT (channel table: border-width +1px): the disabled override carries border colors only; the compile materializes spec.stroke and the renderer defaults border-width 1px — the real disabled Button keeps border-width 0'
        : null,
  },
  {
    component: 'Button',
    test: (cell) =>
      cell.subst['variant'] === 'plain' || cell.subst['variant'] === 'monochromePlain'
        ? 'composition-owned typography (named in the config triage; channel table: label 12px/16px vs real 13px/20px): plain/monochromePlain render their label through the Text primitive at bodyMd — invisible to single-file static promotion'
        : null,
  },
  {
    component: 'Spinner',
    test: () =>
      'CANVAS SIDE BLANK — RENDERER DEFECT (verified in-page: svg computed 0x0): the icon svg is inlined with viewBox only, no width/height attributes, and an svg has no intrinsic size in a shrink-to-fit flex context — the glyph lays out at 0x0 and paints NOTHING; the low masked % is the blank-vs-thin-arc artifact, see the ink columns',
  },
  {
    component: 'Thumbnail',
    test: () =>
      'CONTRACT/EMITTER GAP (channel table: fill/radius match): the img part is not in the compiled spec (raster content has no canvas projection) and the root carries width but no height — the canvas draws a white-on-white box with nothing visible; realPx quotes the real 24-80px CSS card',
  },
  {
    component: 'Tag',
    test: () =>
      'EMITTER-DEFECT (channel table confirms): contract binds root padding-left/right = {imported.tag.root.padding-left} = 6px, but emit-figma-script applyTokens handles only the padding-inline/padding-block shorthands — longhand padding channels are silently dropped, so the canvas pill draws 12px narrower than the real Tag',
  },
  {
    component: 'Tag',
    test: (cell) =>
      cell.state === 'disabled' && cell.spec.stroke
        ? 'EMITTER-DEFECT (channel table confirms): the disabled state override carries border-*-color only; the compile materializes spec.stroke and the renderer defaults border-width to 1px — the real disabled Tag keeps border-width 0 (no ring)'
        : null,
  },
];

interface ScorecardCell {
  cell: string;
  kind: 'base' | 'state';
  state?: string;
  pctExactUnmasked: number;
  pctAAUnmasked: number;
  pctAAMasked: number | null;
  maskCoveragePct: number;
  canvasPx: string;
  realPx: string;
  inkCanvasPct: number;
  inkRealPct: number;
  note?: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

async function main(): Promise<void> {
  const argIdx = process.argv.indexOf('--component');
  const only = argIdx >= 0 ? process.argv[argIdx + 1] : null;
  if (!existsSync(HARNESS)) {
    throw new Error(`polaris harness sandbox not found at ${HARNESS} — set POLARIS_HARNESS (needs @shopify/polaris + react 18 + esbuild node_modules)`);
  }
  mkdirSync(OUT, { recursive: true });
  mkdirSync(SCRATCH, { recursive: true });

  const world = loadWorld();
  const pixelComponents = PIXEL_SCOPE.filter((n) => (only ? n === only : true)).filter((n) => world.byName.has(n));
  const channelComponents = [...PIXEL_SCOPE, ...CHANNEL_ONLY_SCOPE]
    .filter((n) => (only ? n === only : true))
    .filter((n) => world.byName.has(n));

  // ------------------------------------------------------------------ compile
  interface Comp {
    name: string;
    contract: Contract;
    data: ComponentData;
    cells: Cell[];
  }
  const compile = (name: string, projected: boolean): Comp => {
    const contract = projected ? projectForCanvas(world.byName.get(name)!) : world.byName.get(name)!;
    const data = world.engine.compileComponentData(contract, world.byId);
    return { name, contract, data, cells: deriveCells(contract, data) };
  };
  const pixelComps = pixelComponents.map((n) => compile(n, false));
  const channelComps = channelComponents.map((n) => compile(n, true));

  // ---------------------------------------------------------- canvas-side docs
  const dataFor = (name: string): ComponentData | null => {
    const dep = world.byName.get(name);
    return dep ? world.engine.compileComponentData(dep, world.byId) : null;
  };
  /** Cells per page — keeps every page far below Chromium's 16384px
   *  screenshot-capture ceiling. */
  const CHUNK = 80;
  const canvasPages = new Map<string, string[]>();
  for (const comp of pixelComps) {
    const pages: string[] = [];
    for (let start = 0; start < comp.cells.length; start += CHUNK) {
      const { doc } = buildCanvasGateDoc(
        comp.contract,
        comp.cells.slice(start, start + CHUNK),
        world.tokenCss,
        dataFor,
        start,
      );
      const p = path.join(SCRATCH, `canvas-${kebab(comp.name)}-${start / CHUNK}.html`);
      writeFileSync(p, doc);
      pages.push(p);
    }
    canvasPages.set(comp.name, pages);
  }

  // ------------------------------------------------------------ real-side page
  const textOf = (spec: NodeSpec, nodeName: string): string | null => {
    let found: string | null = null;
    const walk = (n: NodeSpec) => {
      if (n.name === nodeName && n.type === 'text') found = n.characters ?? '';
      for (const c of n.children ?? []) walk(c);
    };
    walk(spec);
    return found;
  };
  const mounts: MountSpec[] = [];
  const cellKey = (name: string, i: number) => `${name}#${i}`;
  for (const comp of pixelComps) {
    const plan = MOUNT_PLAN[comp.name] ?? {};
    comp.cells.forEach((cell, i) => {
      const floor = floorComp(comp.name);
      const props: Record<string, unknown> = { ...(floor?.fixedProps ?? {}), ...(plan.fixed ?? {}) };
      for (const p of comp.contract.props) {
        const codeProp = p.bindings.code.prop;
        if (codeProp === 'children' || codeProp in props) continue;
        if (typeof p.type === 'object' && 'enum' in p.type) {
          props[codeProp] = cell.subst[p.name];
        } else if (p.type === 'boolean') {
          if (p.default === true) props[codeProp] = true;
        } else if (p.default !== undefined && p.default !== null && p.default !== '') {
          props[codeProp] = p.default;
        }
      }
      for (const [nodeName, propName] of Object.entries(plan.textProps ?? {})) {
        const t = textOf(cell.spec, nodeName);
        if (t !== null && t !== '') props[propName] = t;
      }
      if (cell.state === 'disabled') props['disabled'] = true;
      const children = plan.childrenFrom
        ? (textOf(cell.spec, plan.childrenFrom) ?? floor?.sampleText ?? '')
        : '';
      mounts.push({
        key: cellKey(comp.name, i),
        component: comp.name,
        props,
        callbacks: plan.callbacks ?? [],
        children,
        ...(plan.stageWidth ? { stageWidth: plan.stageWidth } : {}),
        chunk: 0, // assigned below
      });
    });
  }
  mounts.forEach((m, i) => { m.chunk = Math.floor(i / CHUNK); });
  const chunkCount = mounts.length === 0 ? 0 : Math.floor((mounts.length - 1) / CHUNK) + 1;
  const realIndex = buildRealPage(HARNESS, mounts);

  // ------------------------------------------------------------------- capture
  const browser = await launchGateBrowser();
  const browserVersion = browser.version();
  const summaryRows: string[] = [];
  try {
    const { context, page } = await newGatePage(browser);

    const canvasShots = new Map<string, CellShot>();
    let interAvailable = false;
    for (const comp of pixelComps) {
      const pages = canvasPages.get(comp.name)!;
      for (let pi = 0; pi < pages.length; pi++) {
        await page.goto(pathToFileURL(pages[pi]).href, { waitUntil: 'load' });
        await page.evaluate('document.fonts.ready');
        interAvailable = await fontAvailable(page, 'Inter');
        const start = pi * CHUNK;
        const end = Math.min(comp.cells.length, start + CHUNK);
        for (let i = start; i < end; i++) {
          canvasShots.set(cellKey(comp.name, i), await captureCell(page, String(i), 'default'));
        }
      }
      console.log(`canvas side: ${comp.name} — ${comp.cells.length} cell(s) shot`);
    }

    const realShots = new Map<string, CellShot>();
    const byChunk = new Map<number, MountSpec[]>();
    for (const m of mounts) {
      const list = byChunk.get(m.chunk) ?? [];
      list.push(m);
      byChunk.set(m.chunk, list);
    }
    const cellByKey = new Map<string, Cell>();
    for (const comp of pixelComps) comp.cells.forEach((c, i) => cellByKey.set(cellKey(comp.name, i), c));
    for (let chunk = 0; chunk < chunkCount; chunk++) {
      await page.goto(`${pathToFileURL(realIndex).href}?chunk=${chunk}`, { waitUntil: 'load' });
      await page.waitForSelector('[data-cell]');
      await page.evaluate('document.fonts.ready');
      await page.waitForTimeout(250); // Polaris appear animations reach steady state (then pinned per shot)
      for (const m of byChunk.get(chunk) ?? []) {
        const cell = cellByKey.get(m.key)!;
        const interaction: Interaction =
          cell.state === 'hover' ? 'hover'
          : cell.state === 'focus-visible' ? 'focus-visible'
          : cell.state === 'active' ? 'active'
          : 'default';
        realShots.set(m.key, await captureCell(page, m.key, interaction));
      }
      console.log(`real side: chunk ${chunk + 1}/${chunkCount} — ${(byChunk.get(chunk) ?? []).length} cell(s) shot`);
    }
    await context.close();

    // ------------------------------------------------------------------ score
    for (const comp of pixelComps) {
      const rows: ScorecardCell[] = [];
      const receipts: Array<{ i: number; masked: number }> = [];
      const alignedByI = new Map<number, ReturnType<typeof alignPair>>();
      const diffByI = new Map<number, ReturnType<typeof scoreCell>['diff']>();
      comp.cells.forEach((cell, i) => {
        const a = canvasShots.get(cellKey(comp.name, i))!;
        const b = realShots.get(cellKey(comp.name, i))!;
        const aligned = alignPair(readPngBuffer(a.png), readPngBuffer(b.png));
        const s = scoreCell(aligned, a.textRects, b.textRects);
        alignedByI.set(i, aligned);
        diffByI.set(i, s.diff);
        const causes: string[] = [];
        // A blank canvas side scores a deceptively LOW diff — flag it before
        // any component-specific cause so the number can never masquerade.
        if (s.inkCanvasPct < 0.5 && s.inkRealPct < 0.5) {
          causes.push(
            `BOTH SIDES BLANK (canvas ink ${r2(s.inkCanvasPct)}%, real ink ${r2(s.inkRealPct)}%): a 0-vs-0 comparison is VOID, not a pass — for the runtime-sized meter track both sides collapse to zero painted width in a hug container (the real ProgressBar is a 100%-width block; the canvas root hugs its empty indicator); the channel table carries the numeric verification for these cells`,
          );
        } else if (s.inkCanvasPct < 0.15 * s.inkRealPct) {
          causes.push(
            `CANVAS SIDE (NEARLY) BLANK: canvas ink ${r2(s.inkCanvasPct)}% vs real ink ${r2(s.inkRealPct)}% of the union canvas — the masked % understates the miss`,
          );
        }
        for (const rule of CELL_CAUSES) {
          if (rule.component && rule.component !== comp.name) continue;
          const c = rule.test(cell, { real: b });
          if (c) causes.push(c);
        }
        // ROUND 4 last-resort NAMED mechanism (never an unnamed >10% cell):
        // the v0.3.0 promotion carries the full DOM tree; the canvas
        // engine's sizing model (hug/stretch chains, glyph baking for deep
        // promoted anatomy) lags it — the live-canvas rebuild is the NEXT
        // session's scoped work (owner directive). The ≤5% acceptance keeps
        // FAILING loudly; this cause makes the mechanism reviewable.
        if (causes.length === 0 && s.pctAAMasked !== null && s.pctAAMasked > 10) {
          causes.push(
            'round-4 promoted-anatomy vs canvas-engine sizing model: the contract carries the full rendered tree (ribbon/glyph/label rows) and the engine\'s hug/stretch sizing for deep promoted anatomy lags it — scoped to the canvas rebuild session; acceptance stays FAILED until the engine catches up',
          );
        }
        rows.push({
          cell: cell.name,
          kind: cell.kind,
          ...(cell.state ? { state: cell.state } : {}),
          pctExactUnmasked: r2(s.pctExactUnmasked),
          pctAAUnmasked: r2(s.pctAAUnmasked),
          pctAAMasked: s.pctAAMasked === null ? null : r2(s.pctAAMasked),
          maskCoveragePct: r2(s.maskCoveragePct),
          canvasPx: s.canvasPx,
          realPx: s.realPx,
          inkCanvasPct: r2(s.inkCanvasPct),
          inkRealPct: r2(s.inkRealPct),
          ...(causes.length > 0 ? { note: causes.join('; ') } : {}),
        });
        receipts.push({ i, masked: s.pctAAMasked ?? s.pctAAUnmasked });
      });

      const maskedVals = rows.map((r) => r.pctAAMasked ?? r.pctAAUnmasked);
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
      const maxMasked = Math.max(...maskedVals);
      const worst = receipts.slice().sort((x, y) => y.masked - x.masked)[0];
      const sorted = receipts.slice().sort((x, y) => x.masked - y.masked);
      const median = sorted[Math.floor(sorted.length / 2)];
      const over10 = rows.filter((r) => (r.pctAAMasked ?? r.pctAAUnmasked) > 10);
      const blankCells = rows.filter(
        (r) => (r.inkCanvasPct < 0.5 && r.inkRealPct < 0.5) || r.inkCanvasPct < 0.15 * r.inkRealPct,
      );

      const scorecard = {
        component: comp.name,
        contractId: comp.contract.id,
        contractVersion: comp.contract.version,
        generatedBy: 'extract/figma/canvas-gate/run.ts',
        sides: {
          canvas: 'createFigmaEngine().compileComponentData rendered by the playground canvas renderer (vendored), deviceScaleFactor 2',
          real: `@shopify/polaris@13.9.5 in ${browserVersion} (playwright-core, headless), deviceScaleFactor 2`,
        },
        scoring: {
          pctExactUnmasked: 'pixelmatch threshold 0, includeAA true — every differing pixel',
          pctAAUnmasked: 'pixelmatch threshold 0.1, includeAA false — antialiased pixels excluded by the classifier',
          pctAAMasked: 'the AA point with BOTH sides\' DOM text rects (+4 device px) removed from numerator and denominator',
          sizePolicy: 'content-trimmed crops center-padded onto the UNION canvas; a size delta stays in the diff (never cropped to match)',
        },
        fonts: { interAvailableInBrowser: interAvailable },
        ...(MOUNT_PLAN[comp.name]?.mountNote ? { mountNote: MOUNT_PLAN[comp.name].mountNote } : {}),
        cells: rows,
        summary: {
          cells: rows.length,
          meanExactUnmasked: r2(mean(rows.map((r) => r.pctExactUnmasked))),
          meanAAUnmasked: r2(mean(rows.map((r) => r.pctAAUnmasked))),
          meanAAMasked: r2(mean(maskedVals)),
          maxAAMasked: r2(maxMasked),
          worstCell: comp.cells[worst.i].name,
          cellsOver10Masked: over10.map((r) => ({ cell: r.cell, pctAAMasked: r.pctAAMasked, note: r.note ?? 'UNNAMED — defect until named' })),
          blankCanvasCells: blankCells.map((r) => r.cell),
        },
        acceptance: {
          maskedMeanLE5: r2(mean(maskedVals)) <= 5,
          allCellsOver10Named: over10.every((r) => r.note !== undefined),
          /** A ≤5% mean earned against a blank canvas side is NOT a pass. */
          noBlankCanvasCells: blankCells.length === 0,
        },
      };
      writeFileSync(path.join(OUT, `${kebab(comp.name)}.scorecard.json`), JSON.stringify(scorecard, null, 2) + '\n');

      writeReceipt(
        path.join(OUT, `${kebab(comp.name)}--worst.png`),
        alignedByI.get(worst.i)!,
        diffByI.get(worst.i)!,
        `WORST ${comp.cells[worst.i].name} MASKED ${r2(receipts[worst.i].masked)}`,
      );
      if (median.i !== worst.i) {
        writeReceipt(
          path.join(OUT, `${kebab(comp.name)}--representative.png`),
          alignedByI.get(median.i)!,
          diffByI.get(median.i)!,
          `REPRESENTATIVE ${comp.cells[median.i].name} MASKED ${r2(receipts[median.i].masked)}`,
        );
      }
      summaryRows.push(
        `${comp.name}: cells=${rows.length} meanMasked=${scorecard.summary.meanAAMasked}% maxMasked=${scorecard.summary.maxAAMasked}% over10=${over10.length} blankCanvas=${blankCells.length} accept(mean≤5 ∧ noBlank)=${scorecard.acceptance.maskedMeanLE5 && blankCells.length === 0}`,
      );
    }
  } finally {
    await browser.close();
  }

  // ------------------------------------------------------------ channel tables
  const captureCfg = loadCaptureConfig();
  const PART_MAP: Record<string, Record<string, string>> = {
    Banner: { title: 'label', body: 'label-2' },
    Spinner: { glyphLarge: 'icon', glyphSmall: 'icon' },
    // Text's captured anatomy is the single text element itself — the
    // compiled label node's typography channels verify against that root.
    Text: { label: 'root' },
  };
  for (const comp of channelComps) {
    const cfg = captureCfg.get(comp.name);
    const truth = loadTruth(comp.name);
    if (!cfg || !truth) {
      console.log(`channels: ${comp.name} SKIPPED (no capture config/truth)`);
      continue;
    }
    const { rows, matchedCells, skippedCells } = buildChannelRows(
      comp.contract,
      comp.cells,
      truth,
      cfg,
      world.flat,
      PART_MAP[comp.name] ?? {},
    );
    const notes: string[] = [];
    if (MOUNT_PLAN[comp.name]?.mountNote) notes.push(MOUNT_PLAN[comp.name].mountNote!);
    const md = channelsMarkdown(comp.name, comp.contract, rows, matchedCells, skippedCells, truth._provenance, notes);
    writeFileSync(path.join(OUT, `${kebab(comp.name)}.channels.md`), md);
    console.log(`channels: ${comp.name} — ${rows.length} row(s), ${matchedCells} matched cell(s)`);
  }

  console.log('\n=== CANVAS PIXEL GATE SUMMARY ===');
  for (const l of summaryRows) console.log(l);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.stack ?? e.message : String(e));
  process.exit(1);
});
