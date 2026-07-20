/**
 * COMPUTED-CAPTURE FLOOR — offline re-run of the CONTRACT-MEDIATED gate over
 * the COMMITTED captured-truth fixtures (no harness, no npm sandbox, no
 * network — the committed capture IS the truth; only a local Chromium is
 * needed, the CERTIFICATION convention).
 *
 *   npm run extract:computed:regate [-- --config <file>] [--component <Name>]
 *
 * Why it exists (S4 round 1): vocabulary lifts change what FUSION can carry,
 * and therefore what the enriched contract renders through emit-html — the
 * gate's computed-equality % moves WITHOUT re-capturing. This runner replays
 * the committed capture through the CURRENT fusion + emitters and re-scores
 * the gate, so a lift's effect on the contract-mediated number is measured
 * against the identical captured truth the committed scorecard measured.
 *
 * Differences from the harness gate (run.ts phase 4), both NAMED:
 *   · pixel pairs are NOT scored (the original npm-package screenshots are
 *     session artifacts, not committed) — computed-equality is the quoted
 *     instrument; pixel re-scoring needs a harness run.
 *   · carried-binding probes resolve token refs against the wrapped library
 *     token stylesheet (cfg.tokens.css) instead of the live library page —
 *     the same custom properties the gate page itself renders with. A drift
 *     between the two would surface as a contradiction-count drift vs the
 *     committed scorecard, which this runner PRINTS for exactly that reason.
 *
 * Output: out/<component>/regate.scorecard.json + a console before→after of
 * the committed scorecard's computed % vs the re-run. Committed harness
 * artifacts (scorecard.json, numbers.json, …) are never touched.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { chromiumExecutable } from '../figma/visual-parity/render.js';
import { mintTokens } from '../../core/mint-tokens.js';
import { flattenTokens } from '../../core/tokens.js';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { validateContract } from '../../core/emit-react.js';
import { loadConfig, propSpaceFor, INTERACTIONS, type SweepResult } from './capture.js';
import {
  alignSweep,
  applyMintToContract,
  boundCheck,
  detectFolds,
  enrichLayout,
  prepareMint,
  styledChannels,
} from './fuse.js';
import { reconstructCaptures, type CapturedTruthFile } from './replay.js';
import { normalizeValue } from './lib.js';
import { runGate } from './gate.js';
import { promoteAnatomy } from './anatomy.js';
import { kebab } from '../types.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};
const CONFIG_PATH = path.resolve(arg('config') ?? path.join(HERE, 'configs', 'polaris.json'));
const ONLY = arg('component');

async function main() {
  const cfg = loadConfig(REPO, CONFIG_PATH);
  const iconAssets = new Map<string, string>();
  if (cfg.icons) {
    for (const f of readdirSync(path.join(REPO, cfg.icons)).sort()) {
      if (f.endsWith('.svg')) iconAssets.set(f.slice(0, -4), readFileSync(path.join(REPO, cfg.icons, f), 'utf8').trim());
    }
  }
  const components = cfg.components.filter(
    (c) => (!ONLY || c.name === ONLY) && existsSync(path.join(HERE, 'out', c.name.toLowerCase(), 'captured-truth.json')),
  );
  if (components.length === 0) {
    console.error(`no committed captured-truth for ${ONLY ?? 'any configured component'}`);
    process.exit(1);
  }

  const browser: Browser = await chromium.launch({ executablePath: chromiumExecutable(), headless: true });
  const context = await browser.newContext({
    viewport: cfg.browser.viewport,
    deviceScaleFactor: cfg.browser.deviceScaleFactor,
    colorScheme: cfg.browser.colorScheme,
  });

  // Token-ref probe page: the wrapped library token stylesheet — the same
  // custom properties the gate page renders with (difference vs the harness
  // probe is NAMED in the header).
  const tokensCss = readFileSync(path.join(REPO, cfg.tokens.css), 'utf8');
  const probePage = await context.newPage();
  const probeHtml = path.join(HERE, 'out', '.regate-probe.html');
  writeFileSync(probeHtml, `<!doctype html><html><head><meta charset="utf-8"><style>${tokensCss}</style></head><body></body></html>`);
  await probePage.goto(`file://${probeHtml}`);
  const probeCache = new Map<string, string>();
  const refToVar = (ref: string) => `--${ref.slice(1, -1).split('.').join('-')}`;
  const probeToken = async (ref: string, computedProp: string): Promise<string> => {
    const key = `${ref}|${computedProp}`;
    const hit = probeCache.get(key);
    if (hit !== undefined) return hit;
    const js = `(() => {
      const el = document.createElement('div');
      el.style.position = 'absolute'; el.style.visibility = 'hidden';
      // border/outline widths compute to 0 when the matching style is 'none'
      // — give the probe a solid style so width tokens read their real value
      el.style.borderStyle = 'solid'; el.style.outlineStyle = 'solid';
      el.style.setProperty(${JSON.stringify(computedProp)}, 'var(${refToVar(ref)})');
      document.body.appendChild(el);
      const v = getComputedStyle(el).getPropertyValue(${JSON.stringify(computedProp)});
      el.remove();
      return v;
    })()`;
    const v = normalizeValue((await probePage.evaluate(js)) as string);
    probeCache.set(key, v);
    return v;
  };

  for (const comp of components) {
    const outDir = path.join(HERE, 'out', comp.name.toLowerCase());
    const truth = JSON.parse(readFileSync(path.join(outDir, 'captured-truth.json'), 'utf8')) as CapturedTruthFile;
    const space = propSpaceFor(REPO, cfg, comp);

    // Reconstruct the sweep from the committed truth (replay-sufficiency is
    // asserted at capture time; the eval re-asserts it offline).
    const captures = reconstructCaptures(truth).map((c) => ({ ...c, combo: `${comp.name}:${c.combo}` }));
    const sweep: SweepResult = {
      captures,
      controls: truth.controls,
      allProps: truth._provenance.channels,
      browserVersion: String(truth._provenance.browser ?? 'committed'),
      fontChecks: {},
      pinnedAnimations: [],
    };

    const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix);
    // Round 4: anatomy promotion in the offline path too (same code path as
    // the harness run; assets stay in memory — files are the harness run's).
    const promotion = promoteAnatomy(space, comp, aligned.union, kebab(space.contract.name));
    const iconAssetsMerged = new Map([...iconAssets, ...promotion.assets]);
    const svgConsumedParts = new Set([...promotion.consumed].map((i) => aligned.partNames[i]));
    const controlStyles = Object.fromEntries(Object.entries(truth.controls).map(([t, n]) => [t, n.style]));
    const styledReceipts: string[] = [];
    const styled = styledChannels(aligned, space, controlStyles, sweep.allProps, styledReceipts);

    const folds = detectFolds(aligned, styled);
    const { rows: boundRows } = await boundCheck(aligned, comp, space, probeToken, promotion.contract);
    const boundConfirmed = boundRows.filter((r) => r.verdict === 'confirmed').length;
    const contradictions = boundRows.filter((r) => r.verdict === 'contradiction');
    const layout = enrichLayout(aligned, space, styled, promotion.contract);
    const prep = prepareMint(aligned, comp, space, styled, folds, layout.handled, promotion.contract, svgConsumedParts);
    const mintBase = mintTokens(comp.name, prep.baseObs, prep.axes);
    const mintStates = mintTokens(comp.name, prep.stateObs, prep.axes);
    // `?? []` keeps the runner executable against pre-v15 fusion builds — the
    // instrument-fidelity check runs it at the pre-lift commit for the
    // baseline number.
    const declaredBase = prep.declared ?? [];
    const declaredState = prep.declaredStates ?? [];
    const { enriched, overflowBindings } = applyMintToContract(
      promotion.contract, space, mintBase, prep.baseObs, mintStates, prep.stateObs, layout.enriched,
      declaredBase, declaredState, prep.setPlaneLiterals ?? [],
    );
    const mergedTree = structuredClone(mintBase.tree) as Record<string, unknown>;
    const mergeInto = (dst: Record<string, unknown>, src: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(src)) {
        if (v && typeof v === 'object' && !('$value' in (v as object))) mergeInto((dst[k] ??= {}) as Record<string, unknown>, v as Record<string, unknown>);
        else if (!(k in dst)) dst[k] = v;
      }
    };
    mergeInto(mergedTree, mintStates.tree as Record<string, unknown>);
    void flattenTokens; // (token flattening rides tokenInventoryFromJson inside the gate)

    ContractSchema.parse(enriched);
    const errs: string[] = [];
    validateContract(enriched as Contract, new Map([[enriched.id, enriched as Contract]]), errs, iconAssetsMerged);
    if (errs.length > 0) {
      throw new Error(`${comp.name}: re-fused enriched contract fails validateContract:\n${errs.slice(0, 8).map((e) => `  - ${e}`).join('\n')}`);
    }

    const namedLosses = [
      ...promotion.refusals.map((r) => `promotion: ${r}`),
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
      origShotsDir: path.join(outDir, '.no-orig-shots'), // absent by design — pixel not re-scored offline
      outDir,
      browserVersion: sweep.browserVersion,
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
      iconAssets: iconAssetsMerged,
      contextStyles: truth.controls['span']?.style ?? {},
    });
    await gatePage.close();

    const regate = {
      _marker:
        'OFFLINE GATE RE-RUN (extract/computed/regate.ts) — committed captured truth replayed through the CURRENT fusion + emitters. Pixel pairs are NOT scored offline (original screenshots are session artifacts); computed-equality is the instrument. The committed scorecard.json (harness run) is untouched.',
      component: comp.name,
      config: path.relative(REPO, CONFIG_PATH),
      capturedBrowser: sweep.browserVersion,
      declared: { base: declaredBase, state: declaredState },
      scorecard: { ...scorecard, rows: scorecard.rows },
    };
    writeFileSync(path.join(outDir, 'regate.scorecard.json'), JSON.stringify(regate, null, 2) + '\n');

    const committed = JSON.parse(readFileSync(path.join(outDir, 'scorecard.json'), 'utf8')) as {
      computed: { pctEqual: number; cellsEqual: number; cellsCompared: number; rowsFullyEqual: number; rows: number };
      fusion: { contradictions: number };
    };
    const fmt = (n: number) => n.toFixed(3);
    console.log(`\n== ${comp.name} (offline regate)`);
    console.log(`  committed gate (harness run): ${fmt(committed.computed.pctEqual)}% computed-equal (${committed.computed.cellsEqual}/${committed.computed.cellsCompared}; ${committed.computed.rowsFullyEqual}/${committed.computed.rows} rows fully equal)`);
    console.log(`  re-run gate (current code):   ${fmt(scorecard.computed.pctEqual)}% computed-equal (${scorecard.computed.cellsEqual}/${scorecard.computed.cellsCompared}; ${scorecard.computed.rowsFullyEqual}/${scorecard.computed.rows} rows fully equal)`);
    console.log(`  declared facts carried: ${declaredBase.length} base + ${declaredState.length} state · code-only remaining: ${prep.codeOnly.length} base + ${prep.stateCodeOnly.length} state`);
    console.log(`  bound contradictions: committed ${committed.fusion.contradictions} vs re-probe ${contradictions.length}${committed.fusion.contradictions === contradictions.length ? ' (probe context equivalent)' : '  ← PROBE-CONTEXT DRIFT — investigate before quoting'}`);
  }

  rmSync(probeHtml, { force: true });
  await probePage.close();
  await browser.close();
}

await main();
