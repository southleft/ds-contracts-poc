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
 *   · `--write-enriched` writes enriched.contract.json only; the harness also
 *     writes the decision-applied resolved.contract.json. The GATE now scores
 *     the resolved contract either way (below) — but an offline re-fuse leaves
 *     resolved.contract.json stale, so a recapture still owns that artifact.
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
import { applyDecisions, type AckedDecision } from './decisions.js';
import {
  alignSweep,
  applyMintToContract,
  boundCheck,
  detectFolds,
  enrichLayout,
  prepareMint,
  pseudoFindings,
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
/** DEFECT FIXED (pseudo-decor v2 round) — `--out`, mirroring run.ts. run.ts
 *  has ALWAYS taken `--out` (the MUI/Tailwind/Astryx libraries live in
 *  out/mui, out/tailwind, out/astryx — see examples/mui/PROVENANCE.md:47);
 *  regate.ts hardcoded `out/<component>`, so for every library EXCEPT
 *  polaris it silently read the POLARIS component of the same name and
 *  crashed with a misleading "base capture missing (<polaris combo key>)".
 *  The offline re-fuse door was therefore only ever open for one library. */
const OUT_ROOT = arg('out') ? path.resolve(arg('out')!) : path.join(HERE, 'out');
/** PSEUDO-DECOR v2 ROUND — RE-FUSE WITHOUT RECAPTURE. With this flag the
 *  runner also writes enriched.contract.json / enriched.extension.json, the
 *  same bytes pathway run.ts uses. The principled door: the CAPTURE is the
 *  truth (replay-sufficiency is byte-asserted at capture time), so re-fusing
 *  it through changed vocabulary is deterministic and needs no Chromium
 *  recapture of the libraries. Guarded — see assertReplaySufficient. */
const WRITE_ENRICHED = process.argv.includes('--write-enriched');

/** GUARD for --write-enriched. Writing contracts from replayed truth is only
 *  legitimate when the truth file really is replay-sufficient. The FULL
 *  assertion (reconstruction == the in-memory sweep, byte-for-byte) runs at
 *  CAPTURE time in run.ts and throws before the file is ever written — so a
 *  committed file carries that guarantee. What is checkable OFFLINE, and what
 *  this asserts, is the file's self-consistency and the reconstruction's
 *  determinism. Anything short of that REFUSES BY NAME and writes nothing. */
function assertReplaySufficient(truth: CapturedTruthFile, component: string): void {
  const refuse = (why: string): never => {
    throw new Error(
      `write-enriched-refused: ${component} — captured truth is not replay-sufficient (${why}); the offline re-fuse writes NO contract for this component (the byte-assert lives in run.ts at capture time — recapture is required)`,
    );
  };
  if (!truth._provenance || !Array.isArray(truth._provenance.channels)) refuse('no _provenance.channels channel list');
  if (!truth.base?.root) refuse('no base capture root');
  if (!Array.isArray(truth.anatomy) || truth.anatomy.length === 0) refuse('empty anatomy table');
  const first = reconstructCaptures(truth);
  if (first.length !== truth.captures.length + 1) {
    refuse(`reconstruction yielded ${first.length} captures for ${truth.captures.length} recorded + 1 base`);
  }
  // determinism: reconstruction is a pure function of the file
  const second = reconstructCaptures(truth);
  if (JSON.stringify(first) !== JSON.stringify(second)) refuse('reconstruction is not deterministic across two runs');
  // every anatomy part must be reachable in at least one reconstructed tree
  const seen = new Set<string>();
  for (const cap of first) {
    const walk = (n: { tag: string; nodes: Array<{ t: string }> }): void => {
      seen.add(n.tag);
      for (const c of n.nodes as Array<{ t: string; el?: typeof n }>) if (c.t === 'el' && c.el) walk(c.el);
    };
    walk(cap.root as never);
  }
  if (seen.size === 0) refuse('reconstructed trees contain no elements');
}

async function main() {
  const cfg = loadConfig(REPO, CONFIG_PATH);
  const iconAssets = new Map<string, string>();
  if (cfg.icons) {
    for (const f of readdirSync(path.join(REPO, cfg.icons)).sort()) {
      if (f.endsWith('.svg')) iconAssets.set(f.slice(0, -4), readFileSync(path.join(REPO, cfg.icons, f), 'utf8').trim());
    }
  }
  const components = cfg.components.filter(
    (c) => (!ONLY || c.name === ONLY) && existsSync(path.join(OUT_ROOT, c.name.toLowerCase(), 'captured-truth.json')),
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
  const probeHtml = path.join(OUT_ROOT, '.regate-probe.html');
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
    const outDir = path.join(OUT_ROOT, comp.name.toLowerCase());
    const truth = JSON.parse(readFileSync(path.join(outDir, 'captured-truth.json'), 'utf8')) as CapturedTruthFile;
    if (WRITE_ENRICHED) assertReplaySufficient(truth, comp.name);
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
    const mintBase = mintTokens(comp.name, prep.baseObs, prep.axes, { nestedPairs: true });
    const mintStates = mintTokens(comp.name, prep.stateObs, prep.axes, { nestedPairs: true });
    // `?? []` keeps the runner executable against pre-v15 fusion builds — the
    // instrument-fidelity check runs it at the pre-lift commit for the
    // baseline number.
    const declaredBase = prep.declared ?? [];
    const declaredState = prep.declaredStates ?? [];
    const { enriched, overflowBindings, enrichmentNotes } = applyMintToContract(
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

    // BYTE FIDELITY with the harness path (run.ts:427): the enriched contract
    // carries the COMPUTED-ENRICHED provenance suffix. The truth file stores a
    // DECORATED browser string ("Chromium 149.x (playwright-core, headless)")
    // while run.ts writes the bare version — take the bare version so an
    // offline re-fuse of unchanged vocabulary is byte-identical to the
    // committed contract (asserted: the Switch re-fuse diff is the translate
    // facts and nothing else).
    const bareBrowser = /Chromium ([\d.]+)/.exec(sweep.browserVersion)?.[1] ?? sweep.browserVersion;
    enriched.description = `${space.contract.description} COMPUTED-ENRICHED (extract/computed): unlabeled styled channels minted from computed-style capture of ${cfg.library.package}@${cfg.library.version} in headless Chromium ${bareBrowser}; overflow channels in the sibling extension file.`;

    ContractSchema.parse(enriched);
    const errs: string[] = [];
    validateContract(enriched as Contract, new Map([[enriched.id, enriched as Contract]]), errs, iconAssetsMerged);
    if (errs.length > 0) {
      throw new Error(`${comp.name}: re-fused enriched contract fails validateContract:\n${errs.slice(0, 8).map((e) => `  - ${e}`).join('\n')}`);
    }

    // RE-FUSE WITHOUT RECAPTURE (pseudo-decor v2 round): ship the contract
    // from committed truth. Same bytes pathway as run.ts (2-space JSON +
    // trailing newline) — guarded by the replay-sufficiency assertion above.
    if (WRITE_ENRICHED) {
      const extension: Record<string, unknown> = {
        _marker: 'NON-SCHEMA EXTENSION BLOCK — computed-capture overflow. Nothing here is contract vocabulary; every entry names why it does not fit (DESIGN §5.4).',
        generatedBy: 'extract/computed/regate.ts --write-enriched (OFFLINE RE-FUSE of the committed captured truth; no library recapture). Difference vs the harness path, NAMED: portal receipts are a capture-time artifact and are absent here; every other receipt is recomputed from the same truth.',
        library: `${cfg.library.package}@${cfg.library.version}`,
        browser: sweep.browserVersion,
        mintedTokens: mergedTree,
        folds,
        foldedStateSkips: prep.foldedStateSkips,
        layout: {
          enriched: layout.enriched,
          contradictions: layout.contradictions,
          receipts: layout.receipts,
          _note: 'computed flex keywords carried via Part.layout (the schema\'s own vocabulary); carried-slot contradictions are receipts, never silent overrides',
        },
        declaredFacts: {
          _note: 'v15 (S4): uniform registry-channel facts carried as Part.declared / Part.declaredStates — first-class contract vocabulary, listed here as the enrichment receipt',
          base: declaredBase,
          state: declaredState,
        },
        codeOnlyChannels: prep.codeOnly,
        stateOverflow: prep.stateCodeOnly,
        overflowBindings,
        pairwiseRefusals: prep.pairwiseRefusals,
        pseudoParts: {
          _reason: 'S5 (DESIGN §5.4): pseudo-element decor has no anatomy spelling — captured, receipted, not carried',
          findings: pseudoFindings(aligned, cfg.library.classPrefix).slice(0, 12),
          totalFindings: pseudoFindings(aligned, cfg.library.classPrefix).length,
        },
        bindingContradictions: contradictions,
        interactionOnDisabled: [...new Set(prep.inertOnDisabled)].slice(0, 20),
        structureReceipts: [...new Set(aligned.structureReceipts)],
        styledChannelReceipts: styledReceipts,
        anatomyJoin: { computed: aligned.anatomyJoin, staticOnly: aligned.staticOnlyParts },
        anatomyPromotion: {
          _note: 'Round 4 DOM-anatomy promotion: computed-only elements carried as REAL parts (extract/computed/anatomy.ts); svg subtrees carried as reconstructed icon assets; presence facts via visibleWhen/stylesWhen; refusals named.',
          partsCarried: [...promotion.partIndex.keys()],
          svgAssets: [...promotion.assets.keys()].sort(),
          receipts: promotion.receipts,
          refusals: promotion.refusals,
        },
        enrichmentNotes,
      };
      writeFileSync(path.join(outDir, 'enriched.contract.json'), JSON.stringify(enriched, null, 2) + '\n');
      writeFileSync(path.join(outDir, 'enriched.extension.json'), JSON.stringify(extension, null, 2) + '\n');
      console.log(`  ✔ ${comp.name}: enriched contract + extension REWRITTEN from committed truth (offline re-fuse)`);
    }

    /** DEFECT FIXED (regate-drift triage): the runner scored the RAW fused
     *  contract while the harness (run.ts:440-465) gates the DECISION-APPLIED
     *  one — every component carrying a decisions.json ledger was therefore
     *  compared against a scorecard produced from a DIFFERENT contract, and
     *  the difference was read as engine drift. Measured cost of the omission
     *  at c9242cc: astryx Slider 87.908 → 55.299 (3 acked decisions), astryx
     *  Badge 100.000 → 96.296, astryx Button 98.099 → 95.391, polaris
     *  Button/Tag/Banner/TextField ~0.2-1.4 each. Ledger-free components were
     *  never affected — which is exactly why mui/tailwind reproduced exactly.
     *  Mirrors run.ts: same file, same semantics, same referee, skips NAMED. */
    let gated = enriched as Contract;
    const decisionNotes: string[] = [];
    const decisionsPath = path.join(outDir, 'decisions.json');
    if (existsSync(decisionsPath)) {
      const decisions = JSON.parse(readFileSync(decisionsPath, 'utf8')) as AckedDecision[];
      const resolved = structuredClone(enriched) as Contract;
      const { applied, skipped } = applyDecisions(resolved, decisions);
      decisionNotes.push(...applied.map((a) => `applied: ${a}`), ...skipped.map((sk) => `SKIPPED: ${sk}`));
      ContractSchema.parse(resolved);
      const resolvedErrs: string[] = [];
      validateContract(resolved, new Map([[resolved.id, resolved]]), resolvedErrs, iconAssetsMerged);
      if (resolvedErrs.length > 0) {
        throw new Error(`${comp.name}: decision-applied contract fails validateContract:\n${resolvedErrs.slice(0, 8).map((e) => `  - ${e}`).join('\n')}`);
      }
      gated = resolved;
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
      enriched: gated,
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
      decisionsReapplied: decisionNotes,
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
    console.log(`  human-acked decisions re-applied: ${decisionNotes.filter((d) => d.startsWith('applied')).length}${decisionNotes.some((d) => d.startsWith('SKIPPED')) ? ` (${decisionNotes.filter((d) => d.startsWith('SKIPPED')).length} SKIPPED — named in regate.scorecard.json)` : ''} — the harness gates this same resolved contract (run.ts:440)`);
    console.log(`  bound contradictions: committed ${committed.fusion.contradictions} vs re-probe ${contradictions.length}${committed.fusion.contradictions === contradictions.length ? ' (probe context equivalent)' : '  ← PROBE-CONTEXT DRIFT — investigate before quoting'}`);
  }

  rmSync(probeHtml, { force: true });
  await probePage.close();
  await browser.close();
}

await main();
