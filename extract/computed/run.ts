/**
 * COMPUTED-CAPTURE FLOOR — production orchestrator.
 *
 *   npm run extract:computed -- --harness <dir> [--config <file>] [--component <Name>]
 *
 * harness = npm sandbox OUTSIDE the repo containing the library named in the
 * config (default: @shopify/polaris@13.9.5) + react@18 + react-dom@18 +
 * esbuild (the examples/polaris/scripts/verify.ts pattern). Network-free at
 * run time; needs a local Chromium (playwright cache / system Chrome /
 * PLAYWRIGHT_CHROMIUM_PATH — the visual-parity discovery convention).
 *
 * Pipeline per component (generalized from extract/computed-spike/run.ts —
 * the working prototype this module productionizes; DESIGN.md there):
 *   1. CAPTURE   real components mounted per enumerated prop combo (policy
 *                §1.4), real browser states driven the visual-parity way,
 *                every enumerated longhand read per element incl. ::before/
 *                ::after. Double-run byte-identity is a REQUIRED self-check.
 *   2. FUSE      folding pass (derived channels) → BOUND (browser-probed
 *                carried bindings; contradictions are first-class receipts →
 *                review-queue.json) → MINT via core/mint-tokens UNCHANGED
 *                (S2/S3-hardened application) → CODE-ONLY extension block.
 *   3. REPLAY    captured truth applied verbatim → computed re-read equality
 *                + pixel vs the original (vocabulary-independent floor).
 *   4. GATE      enriched contract → emit-html → pixel + computed-equality
 *                vs the original per combo×state → scorecard.json.
 *
 * Committed artifacts land in extract/computed/out/<component>/. The eval
 * `computed-floor-gate` replays the committed Button capture offline through
 * replay.ts (fixtures committed; browser required, named if absent).
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { chromiumExecutable } from '../figma/visual-parity/render.js';
import { mintTokens } from '../../core/mint-tokens.js';
import { flattenTokens } from '../../core/tokens.js';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { validateContract } from '../../core/emit-react.js';
import {
  buildHarnessPage,
  loadConfig,
  propSpaceFor,
  sweep,
  INTERACTIONS,
  type CaptureConfig,
  type ComponentConfig,
  type PropSpace,
  type SweepResult,
} from './capture.js';
import {
  alignSweep,
  applyMintToContract,
  boundCheck,
  detectFolds,
  enrichLayout,
  prepareMint,
  pseudoFindings,
  styledChannels,
  type AlignedSweep,
  type BoundRow,
} from './fuse.js';
import {
  buildReplayHtml,
  reconstructCaptures,
  rereadEquality,
  type CapturedTruthFile,
  type ReplaySpec,
  type TruthCaptureEntry,
} from './replay.js';
import { runGate } from './gate.js';
import { flatten, normalizeValue, type Capture, type CapturedNode, type FlatEl, type StyleMap } from './lib.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const CONFIG_PATH = path.resolve(arg('config') ?? path.join(HERE, 'configs', 'polaris.json'));
const HARNESS = arg('harness') ? path.resolve(arg('harness')!) : null;
const ONLY = arg('component');

async function main() {
  const t0 = Date.now();
  const cfg = loadConfig(REPO, CONFIG_PATH);
  if (!HARNESS || !existsSync(path.join(HARNESS, 'node_modules', ...cfg.library.package.split('/')))) {
    console.error(`need --harness <dir> with ${cfg.library.package}@${cfg.library.version}, react@18, react-dom@18, esbuild installed`);
    process.exit(1);
  }
  const libPkg = JSON.parse(
    readFileSync(path.join(HARNESS, 'node_modules', ...cfg.library.package.split('/'), 'package.json'), 'utf8'),
  ) as { version: string };
  if (libPkg.version !== cfg.library.version) {
    console.error(`harness has ${cfg.library.package}@${libPkg.version}, config pins ${cfg.library.version} — refusing (version drift would silently change every number)`);
    process.exit(1);
  }

  const components = cfg.components.filter((c) => !ONLY || c.name === ONLY);
  if (components.length === 0) {
    console.error(`no component named ${ONLY} in ${CONFIG_PATH}`);
    process.exit(1);
  }
  const mounts = components.map((comp) => ({ comp, space: propSpaceFor(REPO, cfg, comp) }));
  for (const { comp, space } of mounts) {
    console.log(
      `${comp.name}: ${space.enumeration.combos.length} combos (${space.enumeration.policy}, cartesian ${space.enumeration.cartesianSize}) × ${INTERACTIONS.length} interactions; axes held fixed: ${space.heldFixed.join(', ') || 'none'}`,
    );
  }

  console.log('phase 1 — building harness page (esbuild over the library package)…');
  const pageHtml = buildHarnessPage(HARNESS, cfg, mounts);

  const browser: Browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
  const context = await browser.newContext({
    viewport: cfg.browser.viewport,
    deviceScaleFactor: cfg.browser.deviceScaleFactor,
    colorScheme: cfg.browser.colorScheme,
  });
  const page = await context.newPage();
  await page.goto(`file://${pageHtml}`);
  await page.waitForSelector('[data-combo]', { timeout: 15_000 });
  await page.evaluate('document.fonts.ready');
  await page.waitForTimeout(400);

  const scratchShots = path.join(HERE, 'out', '.orig-shots');
  rmSync(scratchShots, { recursive: true, force: true });

  console.log('phase 1 — capture sweep…');
  const fontProbes = ['-apple-system', 'Segoe UI', 'Inter'];
  const run1 = await sweep(page, mounts, { screenshots: scratchShots, fontProbes });
  console.log(`  ${run1.captures.length} captures, ${run1.allProps.length} channels enumerated, browser ${run1.browserVersion}`);

  console.log('phase 1 — determinism: second full sweep (no screenshots)…');
  const run2 = await sweep(page, mounts, { fontProbes });
  const canon = (r: SweepResult) => JSON.stringify({ captures: r.captures, controls: r.controls });
  const deterministic = canon(run1) === canon(run2);
  let determinismDetail = 'byte-identical across two full sweeps in one session';
  if (!deterministic) {
    const unstable = new Set<string>();
    for (let i = 0; i < run1.captures.length; i++) {
      const a = flatten(run1.captures[i].root);
      const b = flatten(run2.captures[i].root);
      for (let j = 0; j < Math.min(a.length, b.length); j++) {
        for (const p of Object.keys(a[j].node.style)) {
          if (a[j].node.style[p] !== b[j].node.style[p]) unstable.add(p);
        }
      }
    }
    determinismDetail = `UNSTABLE channels across double-run: ${[...unstable].sort().join(', ') || '(structural)'}`;
    console.log(`  ✖ ${determinismDetail}`);
    throw new Error(`determinism self-check FAILED — ${determinismDetail}`);
  }
  console.log(`  double-run byte-identity: IDENTICAL`);

  // Browser-probe for carried token refs (canonical values — the browser is
  // the only normalizer; probed on the capture page, which carries the
  // library's custom properties).
  const probeCache = new Map<string, string>();
  const refToVar = (ref: string) => `--${ref.slice(1, -1).split('.').join('-')}`;
  const probeToken = async (ref: string, computedProp: string): Promise<string> => {
    const key = `${ref}|${computedProp}`;
    const hit = probeCache.get(key);
    if (hit !== undefined) return hit;
    const js = `(() => {
      const el = document.createElement('div');
      el.style.position = 'absolute'; el.style.visibility = 'hidden';
      el.style.setProperty(${JSON.stringify(computedProp)}, 'var(${refToVar(ref)})');
      document.body.appendChild(el);
      const v = getComputedStyle(el).getPropertyValue(${JSON.stringify(computedProp)});
      el.remove();
      return v;
    })()`;
    const v = normalizeValue((await page.evaluate(js)) as string);
    probeCache.set(key, v);
    return v;
  };

  // DTCG candidate lookup for the review queue (value → token names; review
  // metadata only, never auto-promoted — ambiguity is the norm).
  const dtcgLeaves: Array<{ path: string; value: string }> = [];
  for (const p of cfg.tokens.dtcg) {
    for (const [tokenPath, entry] of flattenTokens(JSON.parse(readFileSync(path.join(REPO, p), 'utf8')) as Record<string, unknown>)) {
      dtcgLeaves.push({ path: tokenPath, value: String((entry as { value: unknown }).value) });
    }
  }
  const canonicalDtcg = (v: string): string => {
    const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(v);
    if (hex) {
      const n = parseInt(hex[1], 16);
      const a = hex[2] ? Math.round((parseInt(hex[2], 16) / 255) * 10000) / 10000 : 1;
      return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    }
    // rem → px at the capture context's 16px root (html font-size is never
    // overridden by the harness — pinned in provenance)
    const rem = /^(-?\d+(?:\.\d+)?)rem$/.exec(v);
    if (rem) return `${Number((Number(rem[1]) * 16).toFixed(4)).toString()}px`;
    return v;
  };
  const candidatesFor = (observed: string): string[] =>
    dtcgLeaves.filter((l) => canonicalDtcg(l.value) === observed || l.value === observed).map((l) => l.path).sort().slice(0, 6);

  for (const { comp, space } of mounts) {
    console.log(`\n== ${comp.name}`);
    const outDir = path.join(HERE, 'out', comp.name.toLowerCase());
    // regenerate GENERATED artifacts only — decisions.json / decisions.md /
    // resolved.contract.json are HUMAN-DECISION artifacts (resolve.ts) and
    // survive regeneration.
    for (const f of ['captured-truth.json', 'enriched.contract.json', 'enriched.extension.json', 'review-queue.json', 'scorecard.json', 'numbers.json', 'pixel-rows.json', 'LEDGER.md', 'gate.html', 'replay.html', 'receipts', 'gate-shots', '.replay-shots']) {
      rmSync(path.join(outDir, f), { recursive: true, force: true });
    }
    mkdirSync(outDir, { recursive: true });

    const aligned = alignSweep(run1, comp, space, cfg.library.classPrefix);
    console.log(`  anatomy: ${aligned.baseFlat.map((e, i) => `${aligned.partNames[i]}(${e.sig})`).join(' → ')}`);

    const controlStyles = Object.fromEntries(Object.entries(run1.controls).map(([t, n]) => [t, n.style]));
    const styledReceipts: string[] = [];
    const styled = styledChannels(aligned, space, controlStyles, run1.allProps, styledReceipts);

    // ---- fusion ----
    console.log('  phase 2 — fusion…');
    const folds = detectFolds(aligned, styled);
    const { rows: boundRows, untriaged } = await boundCheck(aligned, comp, space, probeToken);
    const boundConfirmed = boundRows.filter((r) => r.verdict === 'confirmed').length;
    const contradictions = boundRows.filter((r) => r.verdict !== 'confirmed');
    console.log(`    bound: ${boundConfirmed}/${boundRows.length} confirmed · ${contradictions.length} contradictions (${untriaged.length} untriaged) · ${folds.length} folds`);

    const layout = enrichLayout(aligned, space, styled);
    const prep = prepareMint(aligned, comp, space, styled, folds, layout.handled);
    const mintBase = mintTokens(comp.name, prep.baseObs, prep.axes);
    const mintStates = mintTokens(comp.name, prep.stateObs, prep.axes);
    const { enriched, overflowBindings, enrichmentNotes } = applyMintToContract(
      space.contract, space, mintBase, prep.baseObs, mintStates, prep.stateObs, layout.enriched,
    );

    const mergedTree = structuredClone(mintBase.tree) as Record<string, unknown>;
    const mergeInto = (dst: Record<string, unknown>, src: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(src)) {
        if (v && typeof v === 'object' && !('$value' in (v as object))) mergeInto((dst[k] ??= {}) as Record<string, unknown>, v as Record<string, unknown>);
        else if (!(k in dst)) dst[k] = v;
      }
    };
    mergeInto(mergedTree, mintStates.tree as Record<string, unknown>);

    enriched.description = `${space.contract.description} COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of ${cfg.library.package}@${cfg.library.version} in headless Chromium ${run1.browserVersion}; overflow channels in the sibling extension file.`;

    // schema + generator validation — the enriched contract must be a REAL
    // contract, not schema-shaped output
    ContractSchema.parse(enriched);
    const validationErrors: string[] = [];
    validateContract(enriched as Contract, new Map([[enriched.id, enriched as Contract]]), validationErrors, new Map());
    if (validationErrors.length > 0) {
      console.log(`    ✖ validateContract: ${validationErrors.length} error(s)`);
      for (const e of validationErrors.slice(0, 8)) console.log(`      - ${e}`);
      throw new Error(`${comp.name}: enriched contract failed generator validation`);
    }

    const pseudo = pseudoFindings(aligned, cfg.library.classPrefix);

    // ---- mint shape counts ----
    const mintKinds = { uniform: 0, perAxis: 0, perPair: 0, refused: 0 };
    for (const b of [...mintBase.bindings, ...mintStates.bindings]) {
      if (b.ref === null) mintKinds.refused++;
      else if (/\{\w+\}\.\{\w+\}/.test(b.ref)) mintKinds.perPair++;
      else if (/\{\w+\}/.test(b.ref.slice(1, -1))) mintKinds.perAxis++;
      else mintKinds.uniform++;
    }

    // ---- review queue (contradiction-resolution workflow, item 3) ----
    const reviewQueue = {
      _marker: 'CONTRADICTION REVIEW QUEUE — computed truth vs static bindings. Resolution is HUMAN-ACK ONLY: extract/computed/resolve.ts applies computed-wins per explicitly named item; nothing auto-resolves.',
      component: comp.name,
      contract: comp.contract,
      generatedBy: 'extract/computed/run.ts',
      browser: run1.browserVersion,
      items: contradictions.map((r) => ({
        id: `${r.combo}|${r.part}|${r.channel}`,
        combo: r.combo,
        part: r.part,
        channel: r.channel,
        ref: r.ref,
        computedProp: r.computedProp,
        expected: r.expected,
        observed: r.observed,
        ...(r.cause ? { cause: r.cause } : { cause: 'UNTRIAGED — a defect until triaged' }),
        candidates: candidatesFor(r.observed),
        status: 'open',
      })),
    };

    // ---- extension block ----
    const extension: Record<string, unknown> = {
      _marker: 'NON-SCHEMA EXTENSION BLOCK — computed-capture overflow. Nothing here is contract vocabulary; every entry names why it does not fit (DESIGN §5.4).',
      generatedBy: 'extract/computed/run.ts',
      library: `${cfg.library.package}@${cfg.library.version}`,
      browser: run1.browserVersion,
      mintedTokens: mergedTree,
      folds,
      foldedStateSkips: prep.foldedStateSkips,
      layout: {
        enriched: layout.enriched,
        contradictions: layout.contradictions,
        receipts: layout.receipts,
        _note: 'computed flex keywords carried via Part.layout (the schema\'s own vocabulary); carried-slot contradictions are receipts, never silent overrides',
      },
      codeOnlyChannels: prep.codeOnly,
      stateOverflow: prep.stateCodeOnly,
      overflowBindings,
      pairwiseRefusals: prep.pairwiseRefusals,
      pseudoParts: {
        _reason: 'S5 (DESIGN §5.4): pseudo-element decor has no anatomy spelling — captured, receipted, not carried',
        findings: pseudo.slice(0, 12),
        totalFindings: pseudo.length,
      },
      bindingContradictions: contradictions,
      interactionOnDisabled: [...new Set(prep.inertOnDisabled)].slice(0, 20),
      structureReceipts: [...new Set(aligned.structureReceipts)],
      styledChannelReceipts: styledReceipts,
      anatomyJoin: { computed: aligned.anatomyJoin, staticOnly: aligned.staticOnlyParts },
      enrichmentNotes,
    };

    // ---- captured-truth file (delta form; replay-sufficient) ----
    const deltaOf = (el: FlatEl | null, basEl: FlatEl): StyleMap | null => {
      if (!el) return null;
      const d: StyleMap = {};
      for (const p of run1.allProps) if (el.node.style[p] !== basEl.node.style[p]) d[p] = el.node.style[p];
      return d;
    };
    const truthCaptures: TruthCaptureEntry[] = [];
    for (const c of aligned.captures) {
      if (c.combo === space.baseComboKey && c.interaction === 'default') continue;
      const key = `${c.combo}__${c.interaction}`;
      const els = aligned.getAligned(key);
      const flatC = flatten(c.root, cfg.library.classPrefix);
      const structureDrifted = els.some((e) => e === null) || flatC.length !== aligned.baseFlat.length;
      const entry: TruthCaptureEntry = {
        key,
        ...(c.focusVisibleMatched !== undefined ? { focusVisibleMatched: c.focusVisibleMatched } : {}),
      };
      if (structureDrifted) {
        entry.fullRoot = c.root;
      } else {
        entry.elements = aligned.baseFlat.map((b, i) => ({ part: aligned.partNames[i], delta: deltaOf(els[i], b) }));
        const pseudoMap: Record<string, StyleMap> = {};
        flatC.forEach((e, i) => {
          for (const [pe, st] of Object.entries(e.node.pseudo)) pseudoMap[`${aligned.partNames[i] ?? e.path}${pe}`] = st as StyleMap;
        });
        if (Object.keys(pseudoMap).length > 0) entry.pseudo = pseudoMap;
      }
      truthCaptures.push(entry);
    }
    const capturedTruth: CapturedTruthFile = {
      _provenance: {
        generatedBy: 'extract/computed/run.ts',
        config: path.relative(REPO, CONFIG_PATH),
        component: comp.name,
        contract: comp.contract,
        library: `${cfg.library.package}@${cfg.library.version}`,
        browser: `Chromium ${run1.browserVersion} (playwright-core, headless)`,
        viewport: cfg.browser.viewport,
        deviceScaleFactor: cfg.browser.deviceScaleFactor,
        colorScheme: cfg.browser.colorScheme,
        stage: cfg.stage,
        sampleText: comp.sampleText,
        channelsEnumerated: run1.allProps.length,
        channels: run1.allProps,
        fontChecks: run1.fontChecks,
        determinism: determinismDetail,
        steadyState: 'transitions left ENABLED (freezing would alter captured transition-* channels); paint channels polled to stability, bounded 600ms',
        interactionDrivers: {
          hover: 'playwright locator.hover({force:true}) — pointer to element center',
          'focus-visible': 'sentinel.focus() + keyboard Tab (keyboard modality; matched state recorded per capture)',
          active: 'hover + mouse.down (held during capture) — honestly hover+active, what a user sees mid-press',
          ...(space.stateProps.length > 0 ? { [space.stateProps.map((s) => s.prop).join('+')]: 'prop-driven (rides the prop sweep)' } : {}),
        },
        enumerationPolicy: `${space.enumeration.policy} (${space.enumeration.combos.length} combos; cartesian ${space.enumeration.cartesianSize} vs limit ${cfg.enumeration.cartesianLimit}); ${space.enumeration.receipts.join('; ')}`,
        axesHeldFixed: space.heldFixed,
      },
      anatomy: aligned.baseFlat.map((e, i) => ({
        part: aligned.partNames[i],
        path: e.path,
        signature: e.sig,
        tag: e.node.tag,
        classes: e.node.classes,
        join: aligned.anatomyJoin[i].join,
      })),
      base: { key: `${space.baseComboKey}__default`, root: aligned.base.root },
      controls: run1.controls,
      captures: truthCaptures,
    };

    // reconstruction equivalence: the committed file must be replay-
    // sufficient — rebuild every capture from the file and compare the
    // replay-relevant projection against the in-memory sweep.
    {
      const rebuilt = reconstructCaptures(capturedTruth);
      const view = (n: CapturedNode): unknown => ({
        tag: n.tag,
        nodes: n.nodes.map((c) => (c.t === 'text' ? c : { t: 'el', el: view(c.el) })),
        style: n.style,
        pseudo: n.pseudo,
      });
      const wantByKey = new Map(aligned.captures.map((c) => [`${c.combo}__${c.interaction}`, c]));
      for (const r of rebuilt) {
        const w = wantByKey.get(`${r.combo}__${r.interaction}`);
        if (!w) throw new Error(`reconstruction produced unknown capture ${r.combo}__${r.interaction}`);
        if (JSON.stringify(view(r.root)) !== JSON.stringify(view(w.root))) {
          throw new Error(`captured-truth file is NOT replay-sufficient for ${r.combo}__${r.interaction} — reconstruction diverges`);
        }
      }
      if (rebuilt.length !== aligned.captures.length) {
        throw new Error(`reconstruction count ${rebuilt.length} ≠ sweep count ${aligned.captures.length}`);
      }
      console.log(`    captured-truth replay-sufficiency: ${rebuilt.length}/${aligned.captures.length} captures reconstruct byte-equal`);
    }

    // ---- phase 3: truth replay + pixel ----
    console.log('  phase 3 — truth replay…');
    const replaySpecs: ReplaySpec[] = aligned.captures.map((c) => ({ key: `${c.combo}__${c.interaction}`, root: c.root }));
    const replayPath = path.join(outDir, 'replay.html');
    writeFileSync(replayPath, buildReplayHtml(replaySpecs, cfg.stage, cfg.browser.colorScheme));
    const replayPage = await context.newPage();
    await replayPage.goto(`file://${replayPath}`);
    await replayPage.waitForFunction('window.__READY === true');
    await replayPage.evaluate('document.fonts.ready');
    await replayPage.waitForTimeout(200);
    const reread = await rereadEquality((js) => replayPage.evaluate(js), replaySpecs, run1.allProps);

    interface PixelRow { key: string; pctExact: number; pctAA: number; note?: string }
    const pixelRows: PixelRow[] = [];
    const replayShots = path.join(outDir, '.replay-shots');
    mkdirSync(replayShots, { recursive: true });
    for (const spec of replaySpecs) {
      const loc = replayPage.locator(`[data-replay="${spec.key}"]`);
      await loc.scrollIntoViewIfNeeded();
      const shot = await loc.screenshot({ timeout: 10_000 });
      writeFileSync(path.join(replayShots, `${spec.key}.png`), shot);
      const origPath = path.join(scratchShots, `${comp.name}--${spec.key}.png`);
      const a = PNG.sync.read(readFileSync(origPath));
      const b = PNG.sync.read(shot);
      if (a.width !== b.width || a.height !== b.height) {
        pixelRows.push({ key: spec.key, pctExact: 100, pctAA: 100, note: `size mismatch ours ${b.width}x${b.height} vs orig ${a.width}x${a.height}` });
        continue;
      }
      const total = a.width * a.height;
      const diffExact = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0, includeAA: true });
      const diffAA = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0.1 });
      pixelRows.push({ key: spec.key, pctExact: (100 * diffExact) / total, pctAA: (100 * diffAA) / total });
    }
    const worst = [...pixelRows].sort((x, y) => y.pctAA - x.pctAA || y.pctExact - x.pctExact).slice(0, 8);
    // paired receipts: base + one hover + one focus + the worst pair
    const receiptsDir = path.join(outDir, 'receipts');
    mkdirSync(receiptsDir, { recursive: true });
    const receiptKeys = [...new Set([
      `${space.baseComboKey}__default`,
      `${space.enumeration.combos.find((c) => Object.values(c.stateFlags).every((f) => !f))?.key}__hover`,
      `${space.enumeration.combos.find((c) => Object.values(c.stateFlags).every((f) => !f))?.key}__focus-visible`,
      worst[0]?.key,
    ])].filter((x): x is string => Boolean(x) && !x.startsWith('undefined'));
    for (const key of receiptKeys) {
      const aPath = path.join(scratchShots, `${comp.name}--${key}.png`);
      const bPath = path.join(replayShots, `${key}.png`);
      if (!existsSync(aPath) || !existsSync(bPath)) continue;
      const a = PNG.sync.read(readFileSync(aPath));
      const b = PNG.sync.read(readFileSync(bPath));
      const gap = 12;
      const outPng = new PNG({ width: a.width + b.width + gap, height: Math.max(a.height, b.height) });
      outPng.data.fill(220);
      PNG.bitblt(a, outPng, 0, 0, a.width, a.height, 0, 0);
      PNG.bitblt(b, outPng, 0, 0, b.width, b.height, a.width + gap, 0);
      writeFileSync(path.join(receiptsDir, `pair--${key}.png`), PNG.sync.write(outPng));
    }
    await replayPage.close();

    // ---- phase 4: the fidelity gate (contract-mediated) ----
    console.log('  phase 4 — fidelity gate (enriched contract → emit-html vs original)…');
    const namedLosses = [
      ...overflowBindings.map((o) => `overflow: ${o.part}.${o.channel}${o.state ? ` [${o.state}]` : ''} — ${o.refusal}`),
      ...prep.codeOnly.map((c) => `code-only: ${c.part}.${c.channel} — ${c.reason}`),
      ...prep.stateCodeOnly.map((c) => `code-only[${c.state}]: ${c.part}.${c.channel} — ${c.reason}`),
    ];
    const gatePage = await context.newPage();
    const scorecard = await runGate({
      page: gatePage,
      repoRoot: REPO,
      cfg,
      comp,
      space,
      aligned,
      enriched: enriched as Contract,
      mintedTree: mergedTree,
      styled,
      origShotsDir: scratchShots,
      outDir,
      browserVersion: run1.browserVersion,
      fusionCounts: {
        boundConfirmed,
        boundCells: boundRows.length,
        contradictions: contradictions.length,
        mintedLeaves: mintBase.count + mintStates.count,
        mintedLeavesUnfolded: prep.unfoldedLeafCount,
        baseBindings: mintBase.bindings.length,
        stateBindings: mintStates.bindings.length,
        codeOnlyChannels: prep.codeOnly.length + prep.stateCodeOnly.length,
        overflowBindings: overflowBindings.length,
        folds: folds.length,
      },
      namedLosses,
    });
    await gatePage.close();

    // ---- artifacts ----
    const fmt = (n: number) => n.toFixed(3);
    const numbers = {
      component: comp.name,
      browser: run1.browserVersion,
      captures: aligned.captures.length,
      combos: space.enumeration.combos.length,
      interactions: INTERACTIONS.length,
      enumerationPolicy: space.enumeration.policy,
      channelsEnumerated: run1.allProps.length,
      elementsPerCapture: aligned.baseFlat.length,
      determinism: determinismDetail,
      styledChannels: Object.fromEntries([...styled].map(([kk, v]) => [kk, v.size])),
      folds: {
        count: folds.length,
        receipts: folds,
        mintedLeavesUnfolded: prep.unfoldedLeafCount,
        mintedLeavesFolded: mintBase.count + mintStates.count,
      },
      bound: {
        cellsChecked: boundRows.length,
        confirmed: boundConfirmed,
        contradictions: contradictions.length,
        untriaged: untriaged.length,
      },
      minted: {
        leaves: mintBase.count + mintStates.count,
        baseBindings: mintBase.bindings.length,
        stateBindings: mintStates.bindings.length,
        byShape: mintKinds,
      },
      codeOnly: { base: prep.codeOnly.length, state: prep.stateCodeOnly.length, overflowBindings: overflowBindings.length },
      pseudoElementFindings: pseudo.length,
      enrichedContractSchemaValid: true,
      enrichedContractGeneratorValid: true,
      replayComputedEquality: reread,
      pixel: {
        pairs: pixelRows.length,
        exact: {
          mean: pixelRows.reduce((n, r) => n + r.pctExact, 0) / pixelRows.length,
          max: Math.max(...pixelRows.map((r) => r.pctExact)),
          perfect: pixelRows.filter((r) => r.pctExact === 0).length,
        },
        aa: {
          mean: pixelRows.reduce((n, r) => n + r.pctAA, 0) / pixelRows.length,
          max: Math.max(...pixelRows.map((r) => r.pctAA)),
          perfect: pixelRows.filter((r) => r.pctAA === 0).length,
        },
        worst: worst.map((r) => ({ key: r.key, pctExact: r.pctExact, pctAA: r.pctAA, ...(r.note ? { note: r.note } : {}) })),
      },
      gate: {
        computedPctEqual: scorecard.computed.pctEqual,
        rowsFullyEqual: scorecard.computed.rowsFullyEqual,
        rows: scorecard.computed.rows,
        pixelPerfectExact: scorecard.pixel.perfectExact,
        pixelPerfectAA: scorecard.pixel.perfectAA,
        pairs: scorecard.pixel.pairs,
      },
      focusVisibleDriverMatched: aligned.captures.filter((c) => c.interaction === 'focus-visible' && c.focusVisibleMatched).length,
      focusVisibleDriverTotal: aligned.captures.filter((c) => c.interaction === 'focus-visible').length,
      // NO runtimeSeconds here: committed receipts must byte-reproduce
      // (wall time prints on the console instead)
    };

    // ---- delta ledger ----
    const ledger: string[] = [
      `# Delta ledger — computed floor × static layer (${comp.name})`,
      '',
      `Generated by extract/computed/run.ts against ${cfg.library.package}@${cfg.library.version} in Chromium ${run1.browserVersion}. Regenerate: \`npm run extract:computed -- --harness <dir> --component ${comp.name}\`.`,
      '',
      `- captures: **${numbers.captures}** (${numbers.combos} combos, ${space.enumeration.policy} × ${numbers.interactions} interactions), channels enumerated per element: **${numbers.channelsEnumerated}** (the browser's full longhand set — no whitelist)`,
      `- determinism: ${determinismDetail}`,
      `- rendered anatomy: ${aligned.baseFlat.map((e, i) => `**${aligned.partNames[i]}** \`${e.sig}\` (${aligned.anatomyJoin[i].join})`).join(' → ')}${aligned.staticOnlyParts.length ? ` · static-part-unrendered: ${aligned.staticOnlyParts.join(', ')}` : ''}`,
      `- axes held fixed at defaults (receipted, not enumerated): ${space.heldFixed.join(', ') || 'none'}`,
      '',
      '## Derived-channel folding (item 4 — before→after quoted)',
      '',
      `Minted leaves WITHOUT folding: **${prep.unfoldedLeafCount}** → WITH folding: **${numbers.minted.leaves}** (${folds.length} folded channels; every fold a named receipt).`,
      '',
      ...folds.map((f) => `- ${f.part}.${f.channel} → folds into \`${f.foldedInto}\`${f.ratio !== undefined ? ` (em ratio ${f.ratio})` : ''} [${f.class}] — equal in EVERY capture; its state deltas ride the source fact`),
      ...(prep.foldedStateSkips.length ? ['', ...prep.foldedStateSkips.map((s) => `- ${s}`)] : []),
      '',
      '## Bound (static layer confirmed by computed truth)',
      '',
      `${boundConfirmed}/${boundRows.length} carried-binding cells string-equal to the browser-probed token value (no tolerance).`,
      ...(contradictions.length
        ? [
            '',
            `### Binding contradictions (${contradictions.length} — the review queue, see review-queue.json; ${untriaged.length} untriaged)`,
            '',
            ...contradictions.map(
              (r: BoundRow) =>
                `- \`${r.combo}\` ${r.part}.${r.channel} (${r.computedProp}) ${r.ref}: expected \`${r.expected}\` observed \`${r.observed}\`` +
                (r.cause ? `\n  - NAMED CAUSE: ${r.cause}` : '\n  - **UNTRIAGED** — a defect until triaged'),
            ),
          ]
        : ['', 'Zero contradictions.']),
      '',
      '## Minted (no name recoverable — core/mint-tokens.ts, unchanged)',
      '',
      `- leaves: **${numbers.minted.leaves}** · bindings: ${numbers.minted.baseBindings} base + ${numbers.minted.stateBindings} state`,
      `- shape: ${mintKinds.uniform} uniform · ${mintKinds.perAxis} per-axis · ${mintKinds.perPair} per-axis-pair · ${mintKinds.refused} refused (uncorrelated — nothing minted, named)`,
      '',
      '## Code-only / overflow (named, in the extension file)',
      '',
      `- base channels outside mintable kinds: **${prep.codeOnly.length}**`,
      ...prep.codeOnly.map((c) => `  - ${c.part}.${c.channel} — ${c.reason} (sample: \`${c.sample.slice(0, 90)}\`, ${c.distinctValues} distinct value(s))`),
      `- state channels outside mintable kinds: **${prep.stateCodeOnly.length}**`,
      ...prep.stateCodeOnly.map((c) => `  - [${c.state}] ${c.part}.${c.channel} — ${c.reason} (sample: \`${c.sample.slice(0, 90)}\`)`),
      `- refused/overflow bindings: **${overflowBindings.length}**`,
      ...overflowBindings.slice(0, 40).map((b) => `  - ${JSON.stringify(b)}`),
      ...(prep.pairwiseRefusals.length ? [`- pairwise-certificate refusals: **${prep.pairwiseRefusals.length}**`, ...prep.pairwiseRefusals.map((r) => `  - ${r}`)] : []),
      '',
      '## Fidelity gate (scorecard.json)',
      '',
      `- computed-equality (styled channels, contract-mediated): **${fmt(scorecard.computed.pctEqual)}%** (${scorecard.computed.cellsEqual}/${scorecard.computed.cellsCompared} cells; ${scorecard.computed.rowsFullyEqual}/${scorecard.computed.rows} combo×state rows fully equal)`,
      `- pixel: ${scorecard.pixel.perfectExact}/${scorecard.pixel.pairs} pairs perfect at threshold 0 · ${scorecard.pixel.perfectAA}/${scorecard.pixel.pairs} at the AA point (mean AA ${fmt(scorecard.pixel.meanAA)}%, max ${fmt(scorecard.pixel.maxAA)}%)`,
      '',
    ];

    writeFileSync(path.join(outDir, 'captured-truth.json'), JSON.stringify(capturedTruth) + '\n');
    writeFileSync(path.join(outDir, 'enriched.contract.json'), JSON.stringify(enriched, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'enriched.extension.json'), JSON.stringify(extension, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'review-queue.json'), JSON.stringify(reviewQueue, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'scorecard.json'), JSON.stringify(scorecard, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'numbers.json'), JSON.stringify(numbers, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'pixel-rows.json'), JSON.stringify(pixelRows, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'LEDGER.md'), ledger.join('\n') + '\n');
    rmSync(replayShots, { recursive: true, force: true });

    console.log(`  ✔ bound ${boundConfirmed}/${boundRows.length} · minted ${numbers.minted.leaves} leaves (unfolded ${prep.unfoldedLeafCount}) · folds ${folds.length}`);
    console.log(`  ✔ replay computed equality ${fmt(reread.pct)}% · pixel AA perfect ${numbers.pixel.aa.perfect}/${pixelRows.length}`);
    console.log(`  ✔ gate computed ${fmt(scorecard.computed.pctEqual)}% · gate pixel AA perfect ${scorecard.pixel.perfectAA}/${scorecard.pixel.pairs}`);
  }

  rmSync(scratchShots, { recursive: true, force: true });
  await browser.close();
  console.log(`\ndone in ${Math.round((Date.now() - t0) / 1000)}s`);
}

await main();
