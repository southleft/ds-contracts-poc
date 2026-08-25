/**
 * COMPUTED-CAPTURE FLOOR — offline re-run of the CONTRACT-MEDIATED gate over
 * the COMMITTED captured-truth fixtures (no harness, no npm sandbox, no
 * network — the committed capture IS the truth; only a local Chromium is
 * needed, the CERTIFICATION convention).
 *
 *   npm run extract:computed:regate [-- --config <file>] [--component <Name>] [--scorecard-out <dir>]
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
import { loadConfig, propSpaceFor, stageFor, INTERACTIONS, type SweepResult } from './capture.js';
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
import { gateInventory, runGate } from './gate.js';
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
/** V1 ACCEPTANCE (docs/23 §D.32) — `--scorecard-out <dir>`. regate.scorecard.json
 *  is a TRACKED artifact under out/<component>/, and this runner used to
 *  overwrite it on every run — which made `extract/computed/drift-check.ts`
 *  (a CHECK) dirty eleven tracked files while it ran. With this flag every
 *  artifact the run produces — the scorecard, the gate page, the gate shots,
 *  the token probe page — lands under <dir>/<component>/ instead, and the
 *  tracked paths are READ ONLY. The captured truth, decisions ledger and
 *  committed scorecards are still read from `--out`. `--write-enriched`
 *  is unaffected: it is a deliberate authoring verb for the tracked contract. */
const SCORECARD_OUT = arg('scorecard-out') ? path.resolve(arg('scorecard-out')!) : null;

/** GUARD for --write-enriched. Writing contracts from replayed truth is only
 *  legitimate when the truth file really is replay-sufficient. The FULL
 *  assertion (reconstruction == the in-memory sweep, byte-for-byte) runs at
 *  CAPTURE time in run.ts and throws before the file is ever written — so a
 *  committed file carries that guarantee. What is checkable OFFLINE, and what
 *  this asserts, is the file's self-consistency and the reconstruction's
 *  determinism. Anything short of that REFUSES BY NAME and writes nothing. */
// @door regate.replay-sufficiency-fence
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
  // @door regate.committed-truth-required
  const components = cfg.components.filter(
    (c) => (!ONLY || c.name === ONLY) && existsSync(path.join(OUT_ROOT, c.name.toLowerCase(), 'captured-truth.json')),
  );
  const refused: string[] = [];
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
  // @door regate.probe-against-token-stylesheet
  const tokensCss = readFileSync(path.join(REPO, cfg.tokens.css), 'utf8');
  const probePage = await context.newPage();
  if (SCORECARD_OUT) mkdirSync(SCORECARD_OUT, { recursive: true });
  const probeHtml = path.join(SCORECARD_OUT ?? OUT_ROOT, '.regate-probe.html');
  writeFileSync(probeHtml, `<!doctype html><html><head><meta charset="utf-8"><style>${tokensCss}</style></head><body></body></html>`);
  await probePage.goto(`file://${probeHtml}`);
  const probeCache = new Map<string, string>();
  const refToVar = (ref: string) => `--${ref.slice(1, -1).split('.').join('-')}`;
  const probeToken = async (ref: string, computedProp: string): Promise<string> => {
    const key = `${ref}|${computedProp}`;
    const hit = probeCache.get(key);
    if (hit !== undefined) return hit;
    // @door regate.token-probe-solid-border
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
    // ONE component's refusal is ONE finding (docs/23 §D.32). Before
    // 2026-08-23 an engine refusal inside fusion/validation threw out of this
    // loop, the remaining components of the library were never re-fused, and
    // the drift check reported all of them NOT RE-FUSED — eleven findings for
    // one cause (polaris Tag). The refusal is printed BY NAME on stderr in a
    // line the drift instrument parses (`REFUSED <Component>: <why>`), and the
    // sweep continues; the process still exits 1 at the end so a bare
    // `npm run extract:computed:regate` cannot read a refusal as green.
    // @door regate.one-refusal-one-finding
    try {
    const outDir = path.join(OUT_ROOT, comp.name.toLowerCase());
    // Where this run's artifacts land: the tracked component dir, or the
    // --scorecard-out mirror of it (see SCORECARD_OUT).
    const artifactDir = SCORECARD_OUT ? path.join(SCORECARD_OUT, comp.name.toLowerCase()) : outDir;
    if (SCORECARD_OUT) mkdirSync(artifactDir, { recursive: true });
    // Where the time goes, per component (printed in the summary): the drift
    // re-measure is a full-lane step because of these numbers, and a claim
    // about its cost should be a measurement, not a memory.
    const tStart = Date.now();
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
      // Same rule as the read-boundary receipts below: an offline re-fuse has
      // no browser to ask which stylesheets were unreadable, so this is EMPTY,
      // never faked. It is a statement about this run's read boundary, and this
      // run did not read the page.
      // @door regate.empty-read-boundary-receipts
      stylesheetSkips: [],
      browserVersion: String(truth._provenance.browser ?? 'committed'),
      fontChecks: {},
      pinnedAnimations: [],
      shadowHostTrails: {},
      // CONFORMANCE FRONTIER (R1/R8): read-boundary receipts belong to the
      // CAPTURE. An offline re-fuse of a committed truth file has no raw tree
      // to take them from — the fold is still APPLIED (reconstructCaptures
      // runs it), only its receipt is not re-derivable. Empty, never faked.
      textFillFolds: {},
      closedShadowSuspects: {},
    };

    const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix);
    // Round 4: anatomy promotion in the offline path too (same code path as
    // the harness run; assets stay in memory — files are the harness run's).
    const promotion = promoteAnatomy(space, comp, aligned.union, kebab(space.contract.name));
    const iconAssetsMerged = new Map([...iconAssets, ...promotion.assets]);
    const svgConsumedParts = new Set([...promotion.consumed].map((i) => aligned.partNames[i]));
    const controlStyles = Object.fromEntries(Object.entries(truth.controls).map(([t, n]) => [t, n.style]));
    const styledReceipts: string[] = [];
    // task #20: fusion is told what the capture WINDOW and the stage were, so
    // a measurement of the harness cannot pass for a measurement of the
    // library (viewport-derived geometry is refused by name in styledChannels).
    const styled = styledChannels(aligned, space, controlStyles, sweep.allProps, styledReceipts, {
      viewport: cfg.browser.viewport,
      stage: stageFor(cfg, comp),
      portaled: comp.portalCapture === true,
    });

    const folds = detectFolds(aligned, styled, styledReceipts);
    const { rows: boundRows } = await boundCheck(aligned, comp, space, probeToken, promotion.contract);
    const boundConfirmed = boundRows.filter((r) => r.verdict === 'confirmed').length;
    const contradictions = boundRows.filter((r) => r.verdict === 'contradiction');
    const layout = enrichLayout(aligned, space, styled, promotion.contract);
    const prep = prepareMint(aligned, comp, space, styled, folds, layout.handled, promotion.contract, svgConsumedParts, new Set(promotion.partIndex.keys()), promotion.gridMintRefusals);
    // mirror run.ts: re-mint + inheritance-refusal receipts ride the styled
    // channel receipts into the extension block (`?? []` — pre-v15 builds).
    // @door regate.styled-receipt-merge
    styledReceipts.push(...(prep.remintReceipts ?? []), ...(prep.inheritanceReceipts ?? []), ...(prep.orphanRefusals ?? []));
    const mintBase = mintTokens(comp.name, prep.baseObs, prep.axes, { nestedPairs: true });
    const mintStates = mintTokens(comp.name, prep.stateObs, prep.axes, { nestedPairs: true });
    // `?? []` keeps the runner executable against pre-v15 fusion builds — the
    // instrument-fidelity check runs it at the pre-lift commit for the
    // baseline number.
    // @door regate.prev15-nullish-defaults
    const declaredBase = prep.declared ?? [];
    const declaredState = prep.declaredStates ?? [];
    // @door regate.base-codeonly-never-rides-contract
    const { enriched, overflowBindings, enrichmentNotes } = applyMintToContract(
      promotion.contract, space, mintBase, prep.baseObs, mintStates, prep.stateObs, layout.enriched,
      declaredBase, declaredState, prep.setPlaneLiterals ?? [],
      { only: prep.inheritanceOnly ?? [], stateDeltas: prep.inheritanceStateDeltas ?? [] },
      prep.stateCodeOnly ?? [],
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
      /** ALTITUDE LINK ROUND — THE RE-FUSE USED TO DELETE THE FRONTIER
       *  RECEIPTS, WHILE CLAIMING IT HAD NOT.
       *
       *  `frontierReceipts` (closed-shadow-root suspects, which pseudo-
       *  elements were read, which were refused by name) are CAPTURE-time
       *  measurements: they come from the live page, not from the truth file,
       *  so an offline re-fuse cannot recompute them. The block simply left
       *  the key out — and the `generatedBy` string above it asserted "portal
       *  receipts … are absent here; EVERY OTHER receipt is recomputed from
       *  the same truth", which was false. Five committed receipts vanished
       *  from altitude Link's extension (and from the promoted
       *  examples/altitude/contracts/link.extension.json downstream) on the
       *  first re-fuse, with the artifact still asserting completeness — the
       *  exact silent-loss shape this pipeline gates everywhere else.
       *
       *  They are now CARRIED FORWARD from the committed extension beside the
       *  truth being replayed (the capture that produced them is the capture
       *  being re-fused), and their provenance is stated. With no committed
       *  extension there is nothing to carry and the absence is NAMED. */
      // @door regate.frontier-receipt-carry-forward
      const priorExtPath = path.join(outDir, 'enriched.extension.json');
      const prior = existsSync(priorExtPath)
        ? (JSON.parse(readFileSync(priorExtPath, 'utf8')) as Record<string, unknown>)
        : null;
      const carriedFrontier = Array.isArray(prior?.frontierReceipts) ? (prior!.frontierReceipts as unknown[]) : null;
      const extension: Record<string, unknown> = {
        _marker: 'NON-SCHEMA EXTENSION BLOCK — computed-capture overflow. Nothing here is contract vocabulary; every entry names why it does not fit (DESIGN §5.4).',
        generatedBy: `extract/computed/regate.ts --write-enriched (OFFLINE RE-FUSE of the committed captured truth; no library recapture). Differences vs the harness path, NAMED: portal receipts are a capture-time artifact and are absent here; the frontier receipts are capture-time too and are CARRIED FORWARD unchanged from the extension this re-fuse overwrote (${carriedFrontier ? `${carriedFrontier.length} receipt(s)` : 'none present — no prior extension beside this truth'}); every other receipt is recomputed from the same truth.`,
        library: `${cfg.library.package}@${cfg.library.version}`,
        // The capture browser, spelled exactly as run.ts spells it — this
        // field documents the browser that CAPTURED the truth, which an
        // offline re-fuse does not change. (It used to be written raw here,
        // so a re-fused component's `browser` silently disagreed with every
        // sibling captured in the same session.)
        browser: bareBrowser,
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
      // SILENT-LOSS ROUND: parts observed only on an INTERACTION plane. The
      // base pass refuses them as "interaction-only"; the state round has no
      // default-plane counterpart to diff against and drops them. Neither end
      // carries the channel, so the loss is stated at both — the base receipt
      // used to say "state rounds own it", which sent the reader to the door
      // that discards it.
      interactionOnlyPlaneDrops: prep.planeAbsentDrops.slice(0, 20),
      interactionOnlyPlaneDropCount: prep.planeAbsentDrops.length,
        structureReceipts: [...new Set(aligned.structureReceipts)],
        styledChannelReceipts: styledReceipts,
        ...(carriedFrontier ? { frontierReceipts: carriedFrontier } : {}),
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
    // @door regate.decisions-reapplied
    const decisionsPath = path.join(outDir, 'decisions.json');
    if (existsSync(decisionsPath)) {
      const decisions = JSON.parse(readFileSync(decisionsPath, 'utf8')) as AckedDecision[];
      const resolved = structuredClone(enriched) as Contract;
      // Apply-time value check: the SAME inventory the gate renders with —
      // literally the same function (gate.ts gateInventory), mirroring
      // run.ts exactly. See the note there.
      // @door regate.decision-inventory-referee
      const { inventory: decisionInventory } = gateInventory(REPO, cfg, mergedTree);
      const { applied, skipped } = applyDecisions(resolved, decisions, decisionInventory);
      decisionNotes.push(...applied.map((a) => `applied: ${a}`), ...skipped.map((sk) => `SKIPPED: ${sk}`));
      ContractSchema.parse(resolved);
      const resolvedErrs: string[] = [];
      validateContract(resolved, new Map([[resolved.id, resolved]]), resolvedErrs, iconAssetsMerged);
      if (resolvedErrs.length > 0) {
        throw new Error(`${comp.name}: decision-applied contract fails validateContract:\n${resolvedErrs.slice(0, 8).map((e) => `  - ${e}`).join('\n')}`);
      }
      gated = resolved;
    }

    // @door regate.named-losses-rollup
    const namedLosses = [
      ...promotion.refusals.map((r) => `promotion: ${r}`),
      ...overflowBindings.map((o) => `overflow: ${o.part}.${o.channel}${o.state ? ` [${o.state}]` : ''} — ${o.refusal}`),
      ...prep.codeOnly.map((c) => `code-only: ${c.part}.${c.channel} — ${c.reason}`),
      ...prep.stateCodeOnly.map((c) => `code-only[${c.state}]: ${c.part}.${c.channel} — ${c.reason}`),
    ];

    const tFused = Date.now();
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
      // @door regate.pixel-not-scored-offline
      origShotsDir: path.join(outDir, '.no-orig-shots'), // absent by design — pixel not re-scored offline
      outDir: artifactDir,
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
      // @door regate.span-control-text-context
      contextStyles: truth.controls['span']?.style ?? {},
    });
    await gatePage.close();
    const tGated = Date.now();

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
    writeFileSync(path.join(artifactDir, 'regate.scorecard.json'), JSON.stringify(regate, null, 2) + '\n');

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
    console.log(`  time: ${((tGated - tStart) / 1000).toFixed(1)}s — replay + fuse ${((tFused - tStart) / 1000).toFixed(1)}s, gate render + score ${((tGated - tFused) / 1000).toFixed(1)}s (${scorecard.computed.rows} gate rows, ${scorecard.computed.cellsCompared} cells)`);
    } catch (e) {
      const why = (e as Error).message.split('\n').filter(Boolean).slice(0, 3).join(' | ');
      refused.push(comp.name);
      console.error(`REFUSED ${comp.name}: ${why}`);
      console.log(`\n== ${comp.name} (offline regate)\n  ✗ REFUSED — ${why.slice(0, 400)}`);
    }
  }

  rmSync(probeHtml, { force: true });
  await probePage.close();
  await browser.close();
  if (refused.length > 0) {
    console.error(`\n✗ ${refused.length} component(s) REFUSED to re-fuse through the current engine: ${refused.join(', ')}`);
    process.exitCode = 1;
  }
}

await main();
