/**
 * THE CROSS-SURFACE CATALOG GATE — `npm run catalog:visual:check`.
 *
 *   npx tsx extract/figma/catalog-visual/run.ts [--contract ds.button]
 *                                               [--write-baseline] [--worst N]
 *
 * WHAT IT COMPARES, and why it is not "screenshot regression".
 * ---------------------------------------------------------------------------
 * docs/12-roadmap.md asks for a "visual regression baseline — screenshot-
 * per-variant-grid comparison, so the class of defect found in the July 2026
 * visual audit is caught mechanically". The referent is commit c6e909e
 * ("three defects found by visual canvas audit"). Diffing a screenshot
 * against a stored reference of OUR OWN OUTPUT would have caught ZERO of the
 * three:
 *
 *   · kbd's empty key badge     — CAUGHT, by an invariant and not by pixels
 *                                   (content-declared-but-empty). Both
 *                                   surfaces agree to 0.00% on identical
 *                                   36x12 boxes, so the diff is blind.
 *   · avatar-group's clipped     — NOT CAUGHT. Re-injected and measured: red
 *     initials                     on a baseline DELTA only, no invariant.
 *   · chat-message's body        — NOT RE-INJECTABLE at HEAD (the engine now
 *     column align                  models CSS's flex stretch default), but
 *                                   its CLASS is alive: ds.chat-message
 *                                   carries a 1155-device-px box divergence.
 *
 * ONE OF THREE, and the score is stated because two of them were wrong on BOTH
 * surfaces from their contract's birth commit — a baseline written at any
 * earlier commit records the DEFECTIVE numbers, so every delta channel
 * compares equal. Only a baseline-independent invariant reaches that class.
 *
 * So this gate is built as the instrument that WOULD have caught them:
 *
 *   1. A CROSS-SURFACE diff. Side A is core/emit-html.ts (the CSS surface),
 *      side B is the canvas renderer over core/emit-figma-script.ts's
 *      compiled ComponentData (the Figma surface) — per variant cell, in one
 *      pinned Chromium, at one deviceScaleFactor, over one token stylesheet.
 *      Neither side is a "reference": they are two emitters that must agree,
 *      so a defect has to be present in BOTH, identically, to pass.
 *   2. An INVARIANT pixels cannot express (see § THE INVARIANT below), which
 *      is what catches the both-surfaces-wrong class.
 *
 * WHAT IS COMMITTED. Scores, not images: baseline.<platform>.json carries one row per
 * cell — {status, masked, unmasked, sizeCss, sizeCanvas, causeClass,
 * invariant} — at ε 0.1pp, and `--write-baseline` is the only thing that
 * moves it. That is what makes the reference REGENERATABLE by a stranger's
 * clone at any commit, the one property visual-parity's live-Figma reference
 * can never have. Only the worst-N triptychs are committed as PNGs.
 *
 * § THE INVARIANT — the kbd class, lifted from canvas-gate/README.md:82-86
 * (inkCanvasPct / inkRealPct / acceptance.noBlankCanvasCells). A cell fails BY
 * NAME, on both surfaces at once, when:
 *   · the contract declares `content: { prop }` and every declared slot
 *     resolves to no text at all               → content-declared-but-empty
 *   · a declared non-empty text renders as nothing on a surface
 *                                              → text-missing-{css,canvas}
 *   · both surfaces are ink-blank (<0.5%)      → both-surfaces-blank
 *   · one surface is <15% of the other's ink   → one-surface-blank
 *   · rendered text escapes its own root's border box. MEASURED CORRECTION:
 *     this does NOT fire on the July avatar-group defect — re-injecting that
 *     one (revert avatar-group.contract.json to c6e909e^) goes red on a
 *     baseline delta alone. It catches a RELATED shape, live at HEAD in
 *     ds.status-dot (glyphs escaping an 8x8 pill by 31 device px).
 * These are DEFECTS, not scores: a new one fails the gate immediately, and a
 * pre-existing one has to be named in INVARIANT_TRIAGE below to stay.
 *
 * FALSIFICATION — both directions, run and quoted in the README:
 *   (a) planting a real cross-surface divergence turns the gate red naming
 *       the affected cells;
 *   (b) forcing the denominator to zero (no contracts) REFUSES — it never
 *       prints a green 0/0.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Browser, Page } from 'playwright-core';
import type { PNG } from 'pngjs';
import { buildCanvasGateDoc } from '../canvas-gate/canvas-doc.js';
import { launchGateBrowser, captureCell, fontAvailable, type CellShot, type Interaction } from '../canvas-gate/shots.js';
import { readPngBuffer, alignPair, scoreCell, type Aligned } from '../canvas-gate/score.js';
import { writeTriptych } from '../visual-parity/img.js';
import { buildCssCellDoc, probeJs, CSS_ROOT_SEL, type Probe } from './css-doc.js';
import { loadCatalogWorld, catalogCells, REPO, type CatalogCell } from './world.js';
import type { ComponentData } from '../../../core/emit-figma-script.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const runtimePlatform = process.platform;
if (runtimePlatform !== 'darwin' && runtimePlatform !== 'linux') {
  throw new Error(`catalog-visual: no reviewed baseline platform for ${runtimePlatform}`);
}
const PLATFORM: 'darwin' | 'linux' = runtimePlatform;
const ARCHITECTURE = process.arch;
if (
  (PLATFORM === 'darwin' && ARCHITECTURE !== 'arm64') ||
  (PLATFORM === 'linux' && ARCHITECTURE !== 'x64')
) {
  throw new Error(`catalog-visual: no reviewed baseline for ${PLATFORM}/${ARCHITECTURE}`);
}
const BASELINE = path.join(HERE, `baseline.${PLATFORM}.json`);
const RECEIPTS = path.join(HERE, 'receipts', PLATFORM);

/** Allowed per-row score drift vs the current platform's baseline, in
 *  percentage points. Linux and macOS use separate committed references:
 *  pinned Chromium + Inter still produce different font metrics/rasterization
 *  across operating systems. Within one platform this absorbs antialiasing
 *  jitter only. It is NOT a fidelity tolerance, and it is two-sided. */
const EPSILON_PP = 0.1;

/** Ink floors for the blank-cell invariant (canvas-gate run.ts:401-409). */
const BLANK_INK_PCT = 0.5;
const ONE_SIDED_INK_RATIO = 0.15;
/** Device-px a text rect may escape its root's border box before it is named.
 *  1px absorbs sub-pixel rounding of a glyph box against an integer border. */
const TEXT_OVERFLOW_PX = 1;

/** Cells per canvas page — well below Chromium's 16384px capture ceiling. */
const CHUNK = 50;

/** Ink floor, mirroring canvas-gate/score.ts WHITE_TRIM: a pixel is INK when
 *  any channel sits meaningfully below white (translucent washes must count). */
const WHITE_TRIM = 250;

/**
 * THE CANVAS SURFACE'S PREVIEW AFFORDANCES, NEUTRALISED — and why that is not
 * hiding a difference.
 *
 * canvas-doc.ts's GATE_CSS draws two things that come from the RENDERER, not
 * from the compiled NodeSpec: a dashed "◇ <name> slot" chip wherever a slot
 * has no declared defaultContent (`.cv-slot__ph`), and a 24×24 minimum on the
 * slot wrapper so an empty slot stays visible (`.cv-slot`). Both exist so a
 * human looking at the playground canvas can see that a slot is there.
 * core/emit-html.ts states the opposite policy in its own header — "an empty
 * slot renders its wrapper empty (absent content is absent)".
 *
 * MEASURED: 90 of the 195 cells carry a chip (0 carry the red
 * "contract not found" chip). Leaving them in makes 46% of the denominator a
 * triage row about a dashed rectangle, which is the "baseline absorbs every
 * difference" failure. Neutralising them compares the paint both emitters
 * actually derive from the contract. Everything the NodeSpec carries is in
 * inline style attributes and is untouched; `.cv-missing` is deliberately NOT
 * suppressed — an unresolvable dependency must stay loud.
 */
const CANVAS_AFFORDANCE_RESET = `<style>
  .cv-slot__ph { display: none !important; }
  .cv-slot { min-width: 0 !important; min-height: 0 !important; }
</style>`;
const HEAD_END = '</head><body>';
function neutralizeAffordances(doc: string): string {
  if (!doc.includes(HEAD_END)) {
    throw new Error(
      `canvas document does not carry the expected "${HEAD_END}" marker — buildCanvasGateDoc's shape changed; ` +
        'the affordance reset cannot be injected blind.',
    );
  }
  return doc.replace(HEAD_END, `${CANVAS_AFFORDANCE_RESET}${HEAD_END}`);
}

/** Capture context. shots.ts hardcodes DPR 2 for its text-rect scaling, so
 *  the deviceScaleFactor is pinned there; the VIEWPORT is widened from
 *  shots.ts newGatePage's 600×800 because measureJs clamps a cell's clip to
 *  the viewport — a component wider than the viewport would be truncated, and
 *  truncated DIFFERENTLY per surface if the two disagree on width, which
 *  would manufacture the very divergence the gate is measuring. There are no
 *  media/container queries in the emitted CSS or the token stylesheet, so
 *  width is otherwise inert (verified: `@media` appears in neither). */
const VIEWPORT = { width: 1400, height: 1200 };
const DPR = 2;

// ---------------------------------------------------------------------------
// Named causes — a difference that is a KNOWN renderer approximation is a
// TRIAGE row carrying its class, never a silent mask. Every rule quotes a
// mechanism, and the summary prints how many cells each one absorbs.
// ---------------------------------------------------------------------------
export type CauseClass =
  | 'canvas-renderer-limit'
  | 'empty-slot-geometry'
  | 'text-raster'
  | 'size-delta';

interface TriageRule {
  class: CauseClass;
  why: string;
  test: (row: MeasuredRow) => boolean;
}

/** Populated after the first measured run — see README § "Triage". */
const TRIAGE: TriageRule[] = [
  {
    class: 'canvas-renderer-limit',
    why:
      'the canvas surface could not resolve a nested instance and drew its red "contract not found" chip ' +
      '(canvas-doc.ts renderInstance). Detected structurally from the canvas document, not from the score — ' +
      'and NOT suppressed by CANVAS_AFFORDANCE_RESET, because an unresolvable dependency is a defect, not chrome.',
    test: (r) => r.canvasMissingInstance,
  },
  // ORDER IS LOAD-BEARING: size-delta MUST be tested before text-raster.
  //
  // TRIAGE.find() returns the FIRST match, and text-raster's test
  // (masked <= eps AND unmasked > eps) is satisfied by almost every large box
  // divergence: the pair is centre-padded onto the union canvas and the text
  // is masked, so what remains on both sides is white and the masked point
  // sits at zero. With text-raster first, MEASURED over the committed
  // baseline, 29 of the 69 rows whose painted box differs by more than 4
  // device px were filed as glyph-rasterisation noise — including
  // ds.chat-message at 1155 device px (109x65 vs 1264x65) and
  // ds.toolbar at 1164 (116x56 vs 1280x56). A box divergence three orders of
  // magnitude past the epsilon band is not font noise, and calling it that is
  // a receipt naming the wrong cause.
  {
    class: 'size-delta',
    why:
      'the two surfaces disagree on the painted box by more than 4 device px in a dimension; the pair is ' +
      'centre-padded onto the union canvas and never resampled, so the whole delta stays in the diff. The ' +
      'size receipt (sizeCss vs sizeCanvas) is the finding — the percentage is downstream of it.',
    test: (r) => r.sizeDeltaPx > 4,
  },
  {
    class: 'text-raster',
    why:
      'the masked point (text regions out of numerator AND denominator) is at or below the ε band while ' +
      'the unmasked point is not: the residue is glyph rasterisation between two DOM text runs that do ' +
      'not share a box, which the mask exists to price out.',
    test: (r) => r.maskedPct !== null && r.maskedPct <= EPSILON_PP && r.unmaskedPct > EPSILON_PP,
  },
  {
    class: 'empty-slot-geometry',
    why:
      'this cell carries a slot with no declared defaultContent. With the renderer chrome neutralised both ' +
      'surfaces draw an EMPTY wrapper, but the two emitters still size that wrapper from different rules ' +
      '(auto-layout child vs CSS flex item), so the residue is slot-wrapper geometry rather than paint. ' +
      'Structural, from the canvas document.',
    test: (r) => r.canvasEmptySlot,
  },
];

/** Invariant verdicts that ALREADY hold at the commit the baseline was
 *  written, each named. A verdict not listed here fails the gate the moment
 *  it appears. Keep this list SHORT and specific — it is the one place a
 *  both-surfaces-wrong defect can hide, so every entry names the cell. */
const INVARIANT_TRIAGE: Record<string, string> = {
  // ---- 9 verdicts standing at the RC baseline -----------------------------
  // Every one is a REAL cross-surface divergence, not an artefact. They are
  // named here so the gate can be wired into a lane while they are open; a
  // tenth verdict, or any change to these nine, fails immediately.

  // 1) ds.blockquote — the CSS surface paints NOTHING (0% ink of its own box)
  //    while the canvas draws the left rule + inset padding. The emitted
  //    markup is <blockquote> with two empty slot wrappers; with no content
  //    the block collapses and the border-left has no height to paint. The
  //    canvas frame keeps its padding, so it draws a 37×30 CSS-px rule.
  'ds.blockquote :: Blockquote :: one-surface-blank':
    'CSS surface paints nothing: an empty <blockquote> collapses to zero height so its border-left has ' +
    'no run to draw, while the canvas frame keeps the contract inset padding and draws the rule. ' +
    'Cross-surface, real, open.',

  // 2-3) ds.divider — no sample content exists on either surface. The canvas
  //    draws the explicit line geometry; the CSS <hr> remains ink-blank in
  //    this fixture. Divider is outside the v1 PROVEN archetype list, so the
  //    release records the measured residual rather than inventing text.
  'ds.divider :: Variant=Strong :: one-surface-blank': DIVIDER_CAUSE(),
  'ds.divider :: Variant=Subtle :: one-surface-blank': DIVIDER_CAUSE(),

  // 4-9) ds.inline / ds.stack — these are empty layout primitives in this
  //    fixture: neither contract declares children/default content. Both
  //    surfaces now render the same empty box after the emitter stopped
  //    inventing the contract name. A 0-vs-0 measurement remains named void.
  'ds.inline :: Gap=Large :: both-surfaces-blank': INLINE_STACK_CAUSE(),
  'ds.inline :: Gap=Medium :: both-surfaces-blank': INLINE_STACK_CAUSE(),
  'ds.inline :: Gap=Small :: both-surfaces-blank': INLINE_STACK_CAUSE(),
  'ds.stack :: Gap=Large :: both-surfaces-blank': INLINE_STACK_CAUSE(),
  'ds.stack :: Gap=Medium :: both-surfaces-blank': INLINE_STACK_CAUSE(),
  'ds.stack :: Gap=Small :: both-surfaces-blank': INLINE_STACK_CAUSE(),
  // A2 composition stems — same empty-fixture class as inline/stack. The
  // catalog supplies no children, so both surfaces are ink-blank by construction.
  'ds.bento-grid :: BentoGrid :: both-surfaces-blank': INLINE_STACK_CAUSE(),
  'ds.grid-gallery :: GridGallery :: both-surfaces-blank': INLINE_STACK_CAUSE(),
  'ds.page-shell :: PageShell :: both-surfaces-blank': INLINE_STACK_CAUSE(),
  'ds.sidebar-layout :: SidebarLayout :: both-surfaces-blank': INLINE_STACK_CAUSE(),
  'ds.two-column :: TwoColumn :: both-surfaces-blank': INLINE_STACK_CAUSE(),
};

function INLINE_STACK_CAUSE(): string {
  return (
    'the catalog fixture supplies no children to this layout primitive, so both surfaces are intentionally ' +
    'ink-blank. The invariant keeps the denominator honest: empty-vs-empty is void evidence, not a fidelity ' +
    'pass. Cross-surface, measured, explicitly outside the v1 supported archetype list.'
  );
}
function DIVIDER_CAUSE(): string {
  return (
    'the empty CSS <hr> paints no measurable ink in this fixture while the canvas draws the contract line. ' +
    'Divider is not a v1-supported archetype; the residual stays named instead of adding fabricated sample text.'
  );
}

/** Ink share of ONE side inside its OWN placed content box on the union
 *  canvas. Threshold and definition mirror canvas-gate/score.ts's inkPct; the
 *  DENOMINATOR is what differs, and deliberately: score.ts divides by the
 *  whole union canvas, which is correct when the two sides are near-identical
 *  in size and wrong here, where a legitimate size delta would report the
 *  smaller side as "blank". */
function inkInPlacement(
  png: PNG,
  place: { content: { width: number; height: number }; offset: { x: number; y: number } },
): number {
  const total = place.content.width * place.content.height;
  if (total <= 0) return 0;
  let n = 0;
  for (let y = 0; y < place.content.height; y++) {
    for (let x = 0; x < place.content.width; x++) {
      const i = ((place.offset.y + y) * png.width + place.offset.x + x) * 4;
      if (png.data[i] < WHITE_TRIM || png.data[i + 1] < WHITE_TRIM || png.data[i + 2] < WHITE_TRIM) n++;
    }
  }
  return (n / total) * 100;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------
interface MeasuredRow {
  key: string;
  contractId: string;
  cellName: string;
  kind: 'base' | 'state';
  state?: string;
  status: 'diffed' | 'refused';
  refusal?: string;
  exactPct: number;
  unmaskedPct: number;
  maskedPct: number | null;
  maskCoveragePct: number;
  sizeCss: string;
  sizeCanvas: string;
  sizeDeltaPx: number;
  /** Ink share of each side WITHIN ITS OWN painted box (not the shared union
   *  canvas). canvas-gate quotes ink over the union because its two sides are
   *  the same component at nearly the same size; here a legitimate size delta
   *  would drag the smaller side's union-relative ink toward zero and fire the
   *  blank-cell invariant on a cell that is not blank at all — measured on the
   *  first full run: 61 flags, of which every one but ds.blockquote was a size
   *  delta wearing a blankness label. */
  inkCssPct: number;
  inkCanvasPct: number;
  cssProbe: Probe | null;
  canvasProbe: Probe | null;
  /** The canvas document for this cell declares a slot with no defaultContent. */
  canvasEmptySlot: boolean;
  /** The canvas document for this cell could not resolve a nested instance. */
  canvasMissingInstance: boolean;
  invariant: string[];
  causeClass: CauseClass | null;
}

interface BaselineRow {
  status: MeasuredRow['status'];
  masked: number | null;
  unmasked: number | null;
  sizeCss: string | null;
  sizeCanvas: string | null;
  causeClass: CauseClass | null;
  invariant: string[];
}
interface Baseline {
  platform: 'darwin' | 'linux';
  architecture: string;
  generatedAt: string;
  headCommit: string | null;
  epsilonPp: number;
  denominator: { contracts: number; cells: number; refusals: string[] };
  rows: Record<string, BaselineRow>;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const pxOf = (s: string) => s.split('x').map(Number);

function headCommit(): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const write = args.includes('--write-baseline');
  const only = args.includes('--contract') ? args[args.indexOf('--contract') + 1] : null;
  const worstN = args.includes('--worst') ? Number(args[args.indexOf('--worst') + 1]) : 6;
  // Falsification hook (see world.ts loadCatalogWorld): a planted corpus,
  // never the repository's own contracts/. Refused together with
  // --write-baseline — a baseline written over a planted corpus would be a
  // reference to a tree that does not exist.
  const contractsDir = args.includes('--contracts-dir') ? args[args.indexOf('--contracts-dir') + 1] : undefined;
  if (contractsDir && write) {
    console.error('✖ --write-baseline refuses --contracts-dir: the baseline must describe the committed contracts/.');
    process.exit(2);
  }

  const world = loadCatalogWorld(contractsDir);
  const comps = catalogCells(world).filter((c) => (only ? c.contract.id === only : true));

  // ------------------------------------------------------ the denominator
  const allCells = comps.flatMap((c) => c.cells);
  console.log(
    `CROSS-SURFACE CATALOG GATE — ${comps.length} contract(s), ${allCells.length} cell(s) ` +
      `(${allCells.filter((c) => c.cell.kind === 'base').length} base + ` +
      `${allCells.filter((c) => c.cell.kind === 'state').length} state-preview)`,
  );
  // A gate that compared nothing is not a green gate. This refusal is
  // falsification (b): point the loader at an empty contracts/ and the run
  // exits 2 instead of printing a 0/0 pass.
  if (comps.length === 0 || allCells.length === 0) {
    console.error(
      `\n✖ REFUSED: the gate's denominator is ZERO (${comps.length} contract(s), ${allCells.length} cell(s)).\n` +
        `  A cross-surface gate with nothing to compare cannot pass — it has measured nothing.\n` +
        `  Source: ${contractsDir ?? 'contracts/'}${only ? ` filtered to --contract ${only}` : ''}.`,
    );
    process.exit(2);
  }

  // ---------------------------------------------------------- canvas docs
  const dataCache = new Map<string, ComponentData | null>();
  const dataFor = (name: string): ComponentData | null => {
    if (!dataCache.has(name)) {
      const dep = world.contracts.find((c) => c.name === name);
      dataCache.set(name, dep ? world.engine.compileComponentData(dep, world.byId) : null);
    }
    return dataCache.get(name)!;
  };

  interface CanvasPage {
    contractId: string;
    doc: string;
    start: number;
    end: number;
  }
  const canvasPages: CanvasPage[] = [];
  const emptySlotCells = new Set<string>();
  const missingInstanceCells = new Set<string>();
  for (const comp of comps) {
    for (let start = 0; start < comp.cells.length; start += CHUNK) {
      const slice = comp.cells.slice(start, start + CHUNK);
      const { doc } = buildCanvasGateDoc(
        comp.contract,
        slice.map((c) => c.cell),
        world.tokenCss,
        dataFor,
        start,
      );
      // Structural facts read PER CELL from its own single-cell document —
      // match the MARKUP, not the stylesheet: GATE_CSS declares `.cv-slot__ph`
      // and `.cv-missing` rules in every document, so a bare substring test
      // classified all 195 cells as placeholder-bearing (caught on the first
      // measured run — ds.kbd, which has no slot at all, came back true).
      for (const c of slice) {
        const one = buildCanvasGateDoc(comp.contract, [c.cell], world.tokenCss, dataFor, 0).doc;
        if (one.includes('class="cv-slot__ph"')) emptySlotCells.add(c.key);
        if (one.includes('class="cv-missing"')) missingInstanceCells.add(c.key);
      }
      canvasPages.push({ contractId: comp.contract.id, doc: neutralizeAffordances(doc), start, end: start + slice.length });
    }
  }

  // ------------------------------------------------------------- capture
  const browser: Browser = await launchGateBrowser();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DPR, colorScheme: 'light' });
  const page: Page = await context.newPage();
  const canvasShots = new Map<string, CellShot>();
  const canvasProbes = new Map<string, Probe | null>();
  const cssShots = new Map<string, CellShot>();
  const cssProbes = new Map<string, Probe | null>();
  const refusals = new Map<string, string>();
  let interAvailable = false;

  try {
    for (const cp of canvasPages) {
      const comp = comps.find((c) => c.contract.id === cp.contractId)!;
      await page.setContent(cp.doc, { waitUntil: 'load' });
      await page.evaluate('Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))])');
      interAvailable = await fontAvailable(page, 'Inter');
      // THE FONT IS AN INPUT, AND IT IS THE ONE INPUT NOT IN THE REPO.
      //
      // Both documents ask for `Inter, system-ui, sans-serif`. Inter is
      // resolved from the MACHINE's installed fonts — it is not in the
      // repository, not in package-lock.json, and not installed by the
      // workflow. Measured by an adversarial pass: strip `Inter, ` from the
      // stack and 119 of 195 cells move their PAINTED BOX, and the masked
      // point moves too (ds.breadcrumbs 0.99 -> 3.26). Those are exactly the
      // two signals a reader is told to trust.
      //
      // So the gate's headline property — "a stranger's clone recomputes the
      // reference at any commit" — is false without it, and the failure is
      // SILENT: every row simply reads differently and the diff looks like a
      // regression. It now REFUSES instead. A gate that answers wrongly on a
      // machine missing an unstated input is worse than one that will not run.
      if (!interAvailable) {
        console.error(
          '\n✖ REFUSED — the font `Inter` is not available to this browser.\n' +
            '  Both surfaces request `Inter, system-ui, sans-serif`, so without it every cell renders in a\n' +
            '  fallback face: measured, 119 of 195 cells move their painted box and the masked point moves\n' +
            '  with them. The committed baseline was written WITH Inter, so a run without it reports a\n' +
            '  corpus-wide regression that is entirely typography.\n' +
            '  Inter is the one input that is neither in this repository nor in package-lock.json.\n' +
            '  Install it (macOS: `brew install --cask font-inter`; Debian/Ubuntu: `apt-get install fonts-inter`)\n' +
            '  or run with --allow-fallback-font to accept scores that are NOT comparable to the baseline.',
        );
        if (!process.argv.includes('--allow-fallback-font')) { await browser.close(); process.exit(2); }
      }
      for (let i = cp.start; i < cp.end; i++) {
        const cell = comp.cells[i];
        try {
          canvasShots.set(cell.key, await captureCell(page, String(i), 'default'));
          canvasProbes.set(cell.key, (await page.evaluate(probeJs(String(i), null))) as Probe | null);
        } catch (e) {
          refusals.set(cell.key, `canvas surface: ${(e as Error).message}`);
        }
      }
    }
    console.log(`canvas surface: ${canvasShots.size}/${allCells.length} cell(s) shot`);

    for (const comp of comps) {
      for (const cell of comp.cells) {
        if (cell.refusal) {
          refusals.set(cell.key, `CSS surface: ${cell.refusal}`);
          continue;
        }
        let doc: string;
        try {
          doc = buildCssCellDoc({
            contract: comp.contract,
            subst: cell.cell.subst,
            bools: cell.cssBools,
            tokenCss: world.tokenCss,
            inventory: world.inventory,
            icons: world.icons,
            contracts: world.byId,
            cellKey: String(cell.index),
          });
        } catch (e) {
          refusals.set(cell.key, `CSS surface: emitHtml refused — ${(e as Error).message.split('\n')[0]}`);
          continue;
        }
        await page.setContent(doc, { waitUntil: 'load' });
        await page.evaluate('Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 5000))])');
        try {
          cssShots.set(cell.key, await captureCell(page, String(cell.index), cell.cssInteraction as Interaction));
          cssProbes.set(cell.key, (await page.evaluate(probeJs(String(cell.index), CSS_ROOT_SEL))) as Probe | null);
        } catch (e) {
          refusals.set(cell.key, `CSS surface: ${(e as Error).message}`);
        }
      }
      console.log(`css surface: ${comp.contract.id} — ${comp.cells.length} cell(s)`);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  // --------------------------------------------------------------- score
  const rows: MeasuredRow[] = [];
  const alignedByKey = new Map<string, { aligned: Aligned; diff: ReturnType<typeof scoreCell>['diff'] }>();
  for (const comp of comps) {
    for (const cell of comp.cells) {
      const base = {
        key: cell.key,
        contractId: comp.contract.id,
        cellName: cell.cell.name,
        kind: cell.cell.kind,
        ...(cell.cell.state ? { state: cell.cell.state } : {}),
        canvasEmptySlot: emptySlotCells.has(cell.key),
        canvasMissingInstance: missingInstanceCells.has(cell.key),
      };
      const refusal = refusals.get(cell.key);
      const a = cssShots.get(cell.key);
      const b = canvasShots.get(cell.key);
      if (refusal || !a || !b) {
        rows.push({
          ...base,
          status: 'refused',
          refusal: refusal ?? 'one surface produced no shot',
          exactPct: 0, unmaskedPct: 0, maskedPct: null, maskCoveragePct: 0,
          sizeCss: '-', sizeCanvas: '-', sizeDeltaPx: 0, inkCssPct: 0, inkCanvasPct: 0,
          cssProbe: null, canvasProbe: null, invariant: [], causeClass: null,
        });
        continue;
      }
      // SIDE A = CSS (emit-html), SIDE B = CANVAS. score.ts is the canvas-gate
      // scorer, whose field names are spelled for THAT gate's two sides
      // (canvas vs real Polaris); here side a is the CSS surface and side b is
      // the canvas surface, so s.canvasPx/inkCanvasPct describe side a = CSS
      // and s.realPx/inkRealPct describe side b = CANVAS. Aliased once, here.
      const aligned = alignPair(readPngBuffer(a.png), readPngBuffer(b.png));
      const s = scoreCell(aligned, a.textRects, b.textRects);
      alignedByKey.set(cell.key, { aligned, diff: s.diff });
      const [cw, ch] = pxOf(s.canvasPx);
      const [kw, kh] = pxOf(s.realPx);
      const inkCss = inkInPlacement(aligned.a, aligned.aPlace);
      const inkCanvas = inkInPlacement(aligned.b, aligned.bPlace);

      const cssProbe = cssProbes.get(cell.key) ?? null;
      const canvasProbe = canvasProbes.get(cell.key) ?? null;

      // ------------------------------------------------ THE INVARIANT
      const invariant: string[] = [];
      const declared = cell.declaredContent;
      if (declared.length > 0 && declared.every((d) => d.text.trim() === '')) {
        invariant.push(
          `content-declared-but-empty: ${comp.contract.id} declares content for ` +
            `${declared.map((d) => `${d.part}←${d.prop}`).join(', ')} and this cell supplies no text for any of them`,
        );
      }
      // text-missing is a CROSS-SURFACE disagreement, not "no text rendered".
      // Measured on the first full run: ds.pagination's compactText part is
      // declared with a non-empty pageLabel but is not shown in the Dots or
      // Pages variants, so an absolute "declared text must render" rule flagged
      // both surfaces for agreeing correctly. The contract-level rule above
      // (content-declared-but-empty) is what carries the kbd class; this one
      // asks the gate's actual question — do the two emitters agree?
      const expectText = declared.some((d) => d.text.trim() !== '');
      if (expectText && cssProbe && canvasProbe && cssProbe.textLen === 0 && canvasProbe.textLen > 0) {
        invariant.push('text-missing-css: a declared content prop renders on the canvas surface and NOT on the CSS surface');
      }
      if (expectText && cssProbe && canvasProbe && canvasProbe.textLen === 0 && cssProbe.textLen > 0) {
        invariant.push('text-missing-canvas: a declared content prop renders on the CSS surface and NOT on the canvas surface');
      }
      if (inkCss < BLANK_INK_PCT && inkCanvas < BLANK_INK_PCT) {
        invariant.push(`both-surfaces-blank: css ink ${r2(inkCss)}%, canvas ink ${r2(inkCanvas)}% of their own boxes — a 0-vs-0 comparison is VOID, not a pass`);
      } else if (inkCss < ONE_SIDED_INK_RATIO * inkCanvas) {
        invariant.push(`one-surface-blank: css ink ${r2(inkCss)}% vs canvas ink ${r2(inkCanvas)}% (each of its OWN painted box)`);
      } else if (inkCanvas < ONE_SIDED_INK_RATIO * inkCss) {
        invariant.push(`one-surface-blank: canvas ink ${r2(inkCanvas)}% vs css ink ${r2(inkCss)}% (each of its OWN painted box)`);
      }
      if (cssProbe && cssProbe.overflowPx > TEXT_OVERFLOW_PX) {
        invariant.push(`text-overflows-root-css: text escapes the root border box by ${cssProbe.overflowPx}px (root ${cssProbe.rootPx})`);
      }
      if (canvasProbe && canvasProbe.overflowPx > TEXT_OVERFLOW_PX) {
        invariant.push(`text-overflows-root-canvas: text escapes the root border box by ${canvasProbe.overflowPx}px (root ${canvasProbe.rootPx})`);
      }

      const row: MeasuredRow = {
        ...base,
        status: 'diffed',
        exactPct: r2(s.pctExactUnmasked),
        unmaskedPct: r2(s.pctAAUnmasked),
        maskedPct: s.pctAAMasked === null ? null : r2(s.pctAAMasked),
        maskCoveragePct: r2(s.maskCoveragePct),
        sizeCss: s.canvasPx,
        sizeCanvas: s.realPx,
        sizeDeltaPx: Math.max(Math.abs(cw - kw), Math.abs(ch - kh)),
        inkCssPct: r2(inkCss),
        inkCanvasPct: r2(inkCanvas),
        cssProbe,
        canvasProbe,
        invariant,
        causeClass: null,
      };
      row.causeClass = TRIAGE.find((t) => t.test(row))?.class ?? null;
      rows.push(row);
    }
  }
  rows.sort((x, y) => x.key.localeCompare(y.key));

  // ------------------------------------------------------------- receipts
  const scored = rows.filter((r) => r.status === 'diffed');
  const worst = scored
    .slice()
    .sort((x, y) => (y.maskedPct ?? y.unmaskedPct) - (x.maskedPct ?? x.unmaskedPct))
    .slice(0, worstN);
  if (write) {
    mkdirSync(RECEIPTS, { recursive: true });
    for (const f of readdirSync(RECEIPTS).filter((f) => f.endsWith('.png'))) {
      // Receipts are worst-N by score; a stale one from a previous worst list
      // would be a picture with no row behind it.
      if (!worst.some((r) => receiptName(r) === f)) rmSync(path.join(RECEIPTS, f));
    }
    for (const r of worst) {
      const ad = alignedByKey.get(r.key);
      if (!ad) continue;
      writeTriptych(
        path.join(RECEIPTS, receiptName(r)),
        {
          a: ad.aligned.a,
          b: ad.aligned.b,
          width: ad.aligned.width,
          height: ad.aligned.height,
          aContent: ad.aligned.aPlace.content,
          bContent: ad.aligned.bPlace.content,
          aOffset: ad.aligned.aPlace.offset,
          aTrimOrigin: ad.aligned.aPlace.trimOrigin,
        },
        ad.diff,
      );
    }
  }

  // -------------------------------------------------------------- report
  console.log(`\n── rows (${rows.length}) ─────────────────────────────────────────`);
  for (const r of rows) {
    if (r.status === 'refused') {
      console.log(`  REFUSED  ${r.key} — ${r.refusal}`);
      continue;
    }
    console.log(
      `  ${(r.maskedPct === null ? `${r.unmaskedPct.toFixed(2)}*` : r.maskedPct.toFixed(2)).padStart(7)}%m ` +
        `${r.unmaskedPct.toFixed(2).padStart(6)}%u  ${r.sizeCss.padStart(9)} vs ${r.sizeCanvas.padEnd(9)} ` +
        `${(r.causeClass ?? '-').padEnd(21)} ${r.key}` +
        (r.invariant.length > 0 ? `\n            ⚑ ${r.invariant.join('\n            ⚑ ')}` : ''),
    );
  }

  const byClass = new Map<string, number>();
  for (const r of scored) byClass.set(r.causeClass ?? 'unclassified', (byClass.get(r.causeClass ?? 'unclassified') ?? 0) + 1);
  const maskedVals = scored.filter((r) => r.maskedPct !== null).map((r) => r.maskedPct as number);
  const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((p, q) => p + q, 0) / xs.length);
  console.log(
    `\nSCORED ${scored.length} · REFUSED ${rows.length - scored.length} · ` +
      `mean masked ${r2(mean(maskedVals))}% · max masked ${r2(Math.max(0, ...maskedVals))}% · Inter ${interAvailable}`,
  );
  console.log('triage classes: ' + [...byClass].map(([k, v]) => `${k}=${v}`).join(' '));

  const flagged = rows.filter((r) => r.invariant.length > 0);
  console.log(`invariant flags: ${flagged.length} cell(s)`);

  // ------------------------------------------------------------ baseline
  if (write) {
    const baseline: Baseline = {
      platform: PLATFORM,
      architecture: ARCHITECTURE,
      generatedAt: new Date().toISOString(),
      headCommit: headCommit(),
      epsilonPp: EPSILON_PP,
      denominator: {
        contracts: comps.length,
        cells: allCells.length,
        refusals: rows.filter((r) => r.status === 'refused').map((r) => `${r.key} — ${r.refusal}`),
      },
      rows: Object.fromEntries(
        rows.map((r) => [
          r.key,
          {
            status: r.status,
            masked: r.status === 'refused' ? null : r.maskedPct,
            unmasked: r.status === 'refused' ? null : r.unmaskedPct,
            sizeCss: r.status === 'refused' ? null : r.sizeCss,
            sizeCanvas: r.status === 'refused' ? null : r.sizeCanvas,
            causeClass: r.causeClass,
            invariant: r.invariant,
          } satisfies BaselineRow,
        ]),
      ),
    };
    if (only) {
      console.error(`\n✖ --write-baseline refuses a --contract filter: the baseline is the FULL denominator, and a partial write would delete every other row.`);
      process.exit(2);
    }
    writeFileSync(BASELINE, JSON.stringify(baseline, null, 1) + '\n');
    console.log(`\nbaseline → ${path.relative(REPO, BASELINE)} (${Object.keys(baseline.rows).length} rows, ${worst.length} triptych receipt(s))`);
    return;
  }

  // ----------------------------------------------------------- the gate
  const failures: string[] = [];

  // 1. the invariant — a defect class, not a score.
  for (const r of flagged) {
    for (const v of r.invariant) {
      const named = INVARIANT_TRIAGE[`${r.key} :: ${v.split(':')[0]}`];
      if (!named) failures.push(`INVARIANT ${r.key}: ${v}`);
      else console.log(`· triaged invariant ${r.key}: ${v.split(':')[0]} — ${named}`);
    }
  }

  // 2. the scores, against the committed baseline.
  if (!existsSync(BASELINE)) {
    console.error(`\n✖ no ${PLATFORM} baseline at ${BASELINE} — run once on that platform with --write-baseline`);
    process.exit(1);
  }
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
  if (baseline.platform !== PLATFORM) {
    console.error(`\n✖ baseline platform ${String(baseline.platform)} does not match runtime ${PLATFORM}`);
    process.exit(1);
  }
  if (baseline.architecture !== ARCHITECTURE) {
    console.error(
      `\n✖ baseline architecture ${String(baseline.architecture)} does not match runtime ${ARCHITECTURE}`,
    );
    process.exit(1);
  }
  const eps = baseline.epsilonPp ?? EPSILON_PP;
  console.log(
    `\n── vs baseline ${baseline.generatedAt} (${baseline.headCommit?.slice(0, 7) ?? 'no commit'}), ε ${eps}pp, ` +
      `denominator ${baseline.denominator.contracts} contracts / ${baseline.denominator.cells} cells ──`,
  );
  if (contractsDir) {
    console.log(`  (planted corpus: ${contractsDir} — rows below are compared against the committed baseline on purpose)`);
  }
  if (!only && !contractsDir && baseline.denominator.cells !== allCells.length) {
    failures.push(
      `DENOMINATOR MOVED: baseline was written over ${baseline.denominator.cells} cell(s) in ` +
        `${baseline.denominator.contracts} contract(s); this run derived ${allCells.length} in ${comps.length}. ` +
        `A gate whose denominator drifts is measuring a different question — review, then --write-baseline.`,
    );
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const [key, b] of Object.entries(baseline.rows)) {
    const cur = byKey.get(key);
    if (!cur) {
      if (only) continue;
      failures.push(`${key}: in baseline, MISSING from this run (a cell vanished)`);
      continue;
    }
    if (cur.status !== b.status) {
      failures.push(`${key}: status ${b.status} → ${cur.status}${cur.refusal ? ` (${cur.refusal})` : ''}`);
      continue;
    }
    if (cur.status === 'refused') continue;
    // BOTH operating points are compared, not just the masked one. Unlike
    // visual-parity — where the other side is Figma's own rasteriser and the
    // unmasked point carries a font difference nobody can close — both sides
    // here are DOM text in the SAME Chromium with the same family, so an
    // unmasked-only move is a real layout or paint change. Measured: the
    // max-height falsification fixture (README § Falsification) moves the CSS
    // box from 122×46 to 122×24 and leaves the MASKED point at 0.00% on all
    // five cells; without this the score half of the gate would have watched
    // that happen and said nothing.
    for (const [label, before, now] of [
      ['masked', b.masked ?? b.unmasked ?? 0, cur.maskedPct ?? cur.unmaskedPct],
      ['unmasked', b.unmasked ?? 0, cur.unmaskedPct],
    ] as Array<[string, number, number]>) {
      const delta = now - before;
      if (Math.abs(delta) > eps) {
        failures.push(
          `${key}: ${label} ${before.toFixed(2)}% → ${now.toFixed(2)}% (Δ${delta > 0 ? '+' : ''}${delta.toFixed(2)}pp, ε ${eps}) ` +
            `· ${b.sizeCss} vs ${b.sizeCanvas} → ${cur.sizeCss} vs ${cur.sizeCanvas}` +
            `${delta < 0 ? ' — an IMPROVEMENT is still a change: re-run with --write-baseline to lock it in' : ''}`,
        );
      }
    }
    // The painted-box sizes are integers in device px and reproduce exactly;
    // they are the finding behind every size-delta row, so they are compared
    // directly rather than only through the percentage they cause.
    if (cur.sizeCss !== b.sizeCss || cur.sizeCanvas !== b.sizeCanvas) {
      failures.push(
        `${key}: painted box moved — css ${b.sizeCss} → ${cur.sizeCss}, canvas ${b.sizeCanvas} → ${cur.sizeCanvas} (device px)`,
      );
    }
    if ((cur.causeClass ?? null) !== (b.causeClass ?? null)) {
      failures.push(`${key}: causeClass ${b.causeClass ?? 'none'} → ${cur.causeClass ?? 'none'}`);
    }
    if (JSON.stringify(cur.invariant) !== JSON.stringify(b.invariant ?? [])) {
      failures.push(`${key}: invariant verdict changed\n      was: ${JSON.stringify(b.invariant ?? [])}\n      now: ${JSON.stringify(cur.invariant)}`);
    }
  }
  for (const r of rows) {
    if (!baseline.rows[r.key]) failures.push(`${r.key}: NEW row not in baseline — review, then --write-baseline`);
  }

  if (failures.length > 0) {
    console.error(`\n✖ ${failures.length} cross-surface failure(s):`);
    for (const f of failures) console.error(`    ${f}`);
    process.exit(1);
  }
  console.log(
    `\n✔ ${scored.length} cell(s) compared across BOTH emitters, every score within ±${eps}pp of the committed ` +
      `baseline, every invariant verdict unchanged, denominator intact (${comps.length} contracts / ${allCells.length} cells).`,
  );
}

const receiptName = (r: MeasuredRow) =>
  `${r.contractId.replace(/[^a-z0-9]+/gi, '-')}--${r.cellName.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.png`;

main().catch((e: unknown) => {
  console.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
  process.exit(1);
});
