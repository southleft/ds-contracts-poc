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
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { chromiumExecutable } from '../figma/visual-parity/render.js';
import { mintTokens } from '../../core/mint-tokens.js';
import { flattenTokens } from '../../core/tokens.js';
import { ContractSchema, walkAnatomy, type Contract } from '../../scripts/contract-schema.js';
import { validateContract } from '../../core/emit-react.js';
import {
  buildHarnessPage,
  buildPortalHarnessPage,
  loadConfig,
  portalSweep,
  propSpaceFor,
  stageFor,
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
  hugEvidence,
  textOutOfBoxEvidence,
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
import { gateInventory, runGate } from './gate.js';
import { promoteAnatomy } from './anatomy.js';
import { labeledPair } from './label-png.js';
import { applyDecisions, type AckedDecision } from './decisions.js';
import { mountSanity, type MountRow } from './mount-sanity.js';
import { kebab } from '../types.js';
import { calcVarSkip, DECOR_PSEUDOS, flatten, normalizeValue, READ_PSEUDOS, REFUSED_PSEUDOS, shorthandVarSkip, type Capture, type CapturedNode, type FlatEl, type StyleMap, okColorToRgba,
} from './lib.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
};
// --root/--out: the ds-contracts CLI seam (`extract --computed`) — config-
// relative paths resolve against --root, artifacts land under --out. Defaults
// are this repo's own layout, so `npm run extract:computed` is unchanged.
const REPO = arg('root') ? path.resolve(arg('root')!) : path.resolve(HERE, '..', '..');
const OUT_ROOT = arg('out') ? path.resolve(arg('out')!) : path.join(HERE, 'out');
const CONFIG_PATH = path.resolve(arg('config') ?? path.join(HERE, 'configs', 'polaris.json'));
const HARNESS = arg('harness') ? path.resolve(arg('harness')!) : null;
const ONLY = arg('component');
/** `--keep-originals`: also commit the REAL npm-package screenshots (see the
 *  block that writes `<out>/<comp>/orig-shots/`). Default OFF — no committed
 *  artifact for any library moves until a round asks for them. */
const KEEP_ORIGINALS = process.argv.includes('--keep-originals');

/** CONFORMANCE FRONTIER (R3) — a refusal that is SCOPED TO ONE COMPONENT.
 *  Anything else thrown out of a component is an engine fault and still stops
 *  the round: quarantine is for a contract the generator registry refuses,
 *  never a way to swallow a bug. */
class QuarantineError extends Error {
  quarantine: { reason: string; detail: string[] };
  constructor(reason: string, detail: string[]) {
    super(`QUARANTINED: ${reason}`);
    this.quarantine = { reason, detail };
  }
}

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

  // committed icon assets (the showcase generators' own map) — contracts
  // carrying icon.asset refs (Spinner) validate/emit against it
  const iconAssets = new Map<string, string>();
  if (cfg.icons) {
    for (const f of readdirSync(path.join(REPO, cfg.icons)).sort()) {
      if (f.endsWith('.svg')) iconAssets.set(f.slice(0, -4), readFileSync(path.join(REPO, cfg.icons, f), 'utf8').trim());
    }
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

  // MOLECULE round: portalCapture components never share the census page —
  // their overlays (fixed, viewport-covering) would paint over every other
  // stage and intercept the interaction drivers. They sweep on their own
  // two-phase page (portalSweep), DEFAULT interaction only (named residual),
  // and rejoin the shared fusion/gate path as ordinary captures.
  const standardMounts = mounts.filter((m) => !m.comp.portalCapture);
  const portalMounts = mounts.filter((m) => m.comp.portalCapture);

  console.log('phase 1 — building harness page (esbuild over the library package)…');
  const pageHtml = buildHarnessPage(HARNESS, cfg, standardMounts);

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

  const scratchShots = path.join(OUT_ROOT, '.orig-shots');
  rmSync(scratchShots, { recursive: true, force: true });

  console.log('phase 1 — capture sweep…');
  const fontProbes = ['-apple-system', 'Segoe UI', 'Inter'];
  const uaBaseline = { stage: cfg.stage, colorScheme: cfg.browser.colorScheme };
  const run1 = await sweep(page, standardMounts, { screenshots: scratchShots, fontProbes, classAllow: cfg.library.classAllow, varPrefix: cfg.library.varPrefix, uaBaseline });
  console.log(`  ${run1.captures.length} captures, ${run1.allProps.length} channels enumerated, browser ${run1.browserVersion}`);

  console.log('phase 1 — determinism: second full sweep (no screenshots)…');
  const run2 = await sweep(page, standardMounts, { fontProbes, classAllow: cfg.library.classAllow, varPrefix: cfg.library.varPrefix, uaBaseline });

  // ---- portal sweeps (MOLECULE round): one two-phase page per component,
  // every combo mounted/reset in isolation, double-swept for determinism,
  // captures appended so fusion/gate treat them as ordinary sweeps. ----
  const portalReceipts = new Map<string, string[]>();
  for (const m of portalMounts) {
    console.log(`phase 1 — portal sweep (${m.comp.name}: ${m.space.enumeration.combos.length} combos, default interaction only)…`);
    const portalHtml = buildPortalHarnessPage(HARNESS, cfg, m);
    const pPage = await context.newPage();
    await pPage.goto(`file://${portalHtml}`);
    await pPage.evaluate('document.fonts.ready');
    await pPage.waitForTimeout(300);
    const pProps = (await pPage.evaluate(
      `(() => { window.__ALL_PROPS = [...getComputedStyle(document.documentElement)].sort(); return window.__ALL_PROPS; })()`,
    )) as string[];
    if (JSON.stringify(pProps) !== JSON.stringify(run1.allProps)) {
      throw new Error(`${m.comp.name}: portal page enumerates a different longhand set than the census page (${pProps.length} vs ${run1.allProps.length}) — refusing`);
    }
    const p1 = await portalSweep(pPage, m.comp, m.space, { screenshots: scratchShots, classAllow: cfg.library.classAllow, classPrefix: cfg.library.classPrefix });
    const p2 = await portalSweep(pPage, m.comp, m.space, { classAllow: cfg.library.classAllow, classPrefix: cfg.library.classPrefix });
    run1.captures.push(...p1.captures);
    run2.captures.push(...p2.captures);
    portalReceipts.set(m.comp.name, p1.receipts);
    await pPage.close();
    console.log(`  ${p1.captures.length} portal captures (${p1.receipts.length} receipt(s))`);
  }
  const canon = (r: SweepResult) => JSON.stringify({ captures: r.captures, controls: r.controls, uaControls: r.uaControls });
  const deterministic = canon(run1) === canon(run2);
  let determinismDetail = 'byte-identical across two full sweeps in one session';
  if (!deterministic) {
    const unstable = new Set<string>();
    // ORGANISM round: the refusal now NAMES where it happened. "UNSTABLE
    // channels: transform" sent the reader hunting; the witness (capture key,
    // element path + signature, both observed values) is what makes the
    // refusal actionable — a determinism refusal without a location is a
    // half-receipt.
    const witnesses: string[] = [];
    // THE STRUCTURAL HALF OF THE SAME RULE. The loop below only ever compared
    // STYLE values at matching indices, so a run whose two sweeps differ in
    // SHAPE — a different capture count, a different element count, a
    // different tag or class set — produced no witness at all and the refusal
    // read `UNSTABLE channels across double-run: (structural)`: a determinism
    // failure that names neither the component nor the difference, which is
    // precisely the half-receipt the comment above forbids. Measured on the
    // Fluent round, where it sent the investigation to the wrong component.
    // Structural witnesses are collected FIRST because a shape difference is
    // the cause and any style difference downstream of it is a consequence.
    if (run1.captures.length !== run2.captures.length) {
      witnesses.push(
        `CAPTURE COUNT: sweep 1 produced ${run1.captures.length} captures, sweep 2 produced ${run2.captures.length}`,
      );
    }
    for (let i = 0; i < Math.min(run1.captures.length, run2.captures.length); i++) {
      if (witnesses.length >= 8) break;
      const a = flatten(run1.captures[i].root);
      const b = flatten(run2.captures[i].root);
      const where = `${run1.captures[i].combo}__${run1.captures[i].interaction}`;
      if (a.length !== b.length) {
        unstable.add('(element count)');
        witnesses.push(`${where}: ELEMENT COUNT ${a.length} vs ${b.length} — the captured tree changed SHAPE between sweeps`);
        continue;
      }
      for (let j = 0; j < a.length; j++) {
        if (witnesses.length >= 8) break;
        if (a[j].sig !== b[j].sig) {
          unstable.add('(signature)');
          witnesses.push(`${where} @${a[j].path || 'root'}: SIGNATURE "${a[j].sig}" vs "${b[j].sig}" — tag/class identity changed between sweeps`);
        }
        const at = a[j].node.nodes.filter((n) => n.t === 'text').map((n) => (n as { v: string }).v).join('');
        const bt = b[j].node.nodes.filter((n) => n.t === 'text').map((n) => (n as { v: string }).v).join('');
        if (at !== bt) {
          unstable.add('(text)');
          witnesses.push(`${where} @${a[j].path || 'root'}: TEXT "${at}" vs "${bt}"`);
        }
      }
    }
    for (let i = 0; i < Math.min(run1.captures.length, run2.captures.length); i++) {
      const a = flatten(run1.captures[i].root);
      const b = flatten(run2.captures[i].root);
      for (let j = 0; j < Math.min(a.length, b.length); j++) {
        for (const p of Object.keys(a[j].node.style)) {
          if (a[j].node.style[p] === b[j].node.style[p]) continue;
          unstable.add(p);
          if (witnesses.length < 8) {
            witnesses.push(
              `${run1.captures[i].combo}__${run1.captures[i].interaction} @${a[j].path || 'root'} (${a[j].sig}) ${p}: "${a[j].node.style[p]}" vs "${b[j].node.style[p]}"`,
            );
          }
        }
      }
    }
    // THE CATCH-ALL, and the reason it exists. The two loops above read
    // `node.style` and the tree shape — they do NOT read `node.pseudo` (the
    // ::before/::after planes) and they do not read `controls` at all, yet
    // BOTH are inside `canon()`. So a run could differ in a field no witness
    // inspects and report `(structural)` with an empty witness list twice in
    // a row, which is what the Fluent round measured. Rather than chase the
    // field list — which is how this gap was introduced — locate the
    // difference from the SAME serialization the comparison itself uses:
    // whatever `canon` can see, this can name. A refusal that cannot point at
    // its own cause is not a refusal, it is a shrug.
    if (witnesses.length === 0) {
      const idx = (() => {
        for (let i = 0; i < Math.min(run1.captures.length, run2.captures.length); i++) {
          if (JSON.stringify(run1.captures[i]) !== JSON.stringify(run2.captures[i])) return i;
        }
        return -1;
      })();
      if (idx >= 0) {
        const s1 = JSON.stringify(run1.captures[idx]);
        const s2 = JSON.stringify(run2.captures[idx]);
        let k = 0;
        while (k < s1.length && k < s2.length && s1[k] === s2[k]) k++;
        unstable.add('(serialized-capture)');
        witnesses.push(
          `${run1.captures[idx].combo}__${run1.captures[idx].interaction}: capture #${idx} serializes differently in a field no field-level witness reads (pseudo-element planes and controls are both inside canon()). First divergence at char ${k}: …${s1.slice(Math.max(0, k - 120), k + 120)}… VS …${s2.slice(Math.max(0, k - 120), k + 120)}…`,
        );
      } else if (JSON.stringify(run1.uaControls) !== JSON.stringify(run2.uaControls)) {
        unstable.add('(uaControls)');
        witnesses.push(
          `UA CONTROLS: every capture is byte-identical; the divergence is in the sweep's UA BASELINE probes (a library-free page) — sweep 1 ${JSON.stringify(run1.uaControls)} vs sweep 2 ${JSON.stringify(run2.uaControls)}`,
        );
      } else if (JSON.stringify(run1.controls) !== JSON.stringify(run2.controls)) {
        unstable.add('(controls)');
        witnesses.push(
          `CONTROLS: every capture is byte-identical; the divergence is in the sweep's CONTROL probes — sweep 1 ${JSON.stringify(run1.controls)} vs sweep 2 ${JSON.stringify(run2.controls)}`,
        );
      }
    }
    determinismDetail = `UNSTABLE channels across double-run: ${[...unstable].sort().join(', ') || '(structural)'}${witnesses.length ? ` — witnesses: ${witnesses.join(' | ')}` : ''}`;
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
      // border/outline widths compute to 0 when the matching style is 'none'
      // — give the probe a solid style so width tokens read their real value
      el.style.borderStyle = 'solid'; el.style.outlineStyle = 'solid';
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

  // MOUNT SANITY (extract/computed/mount-sanity.ts) — one row per component
  // that produced a contract, compared to each other AFTER the loop. It is
  // run-level on purpose: the check reads across components, and writing its
  // verdict into a component's own directory would make that component's
  // artifacts a function of which siblings shared the sweep — exactly the
  // property `capture-scope-independence` proves they do not have.
  const mountRows: MountRow[] = [];

  const runOne = async (comp: ComponentConfig, space: PropSpace): Promise<void> => {
    console.log(`\n== ${comp.name}`);
    const outDir = path.join(OUT_ROOT, comp.name.toLowerCase());
    // regenerate GENERATED artifacts only — decisions.json / decisions.md /
    // resolved.contract.json are HUMAN-DECISION artifacts (resolve.ts) and
    // survive regeneration.
    for (const f of ['captured-truth.json', 'enriched.contract.json', 'enriched.extension.json', 'review-queue.json', 'source-bindings.json', 'scorecard.json', 'numbers.json', 'pixel-rows.json', 'LEDGER.md', 'gate.html', 'replay.html', 'receipts', 'gate-shots', 'orig-shots', '.replay-shots', 'assets']) {
      rmSync(path.join(outDir, f), { recursive: true, force: true });
    }
    mkdirSync(outDir, { recursive: true });

    const aligned = alignSweep(run1, comp, space, cfg.library.classPrefix);
    console.log(`  anatomy: ${aligned.baseFlat.map((e, i) => `${aligned.partNames[i]}(${e.sig})`).join(' → ')}`);

    // ---- Round 4: DOM-anatomy promotion (computed-only parts become REAL
    // contract parts; svg subtrees become committed icon assets) ----
    const promotion = promoteAnatomy(space, comp, aligned.union, kebab(space.contract.name));
    console.log(`    promotion: ${promotion.partIndex.size} parts carried (${promotion.assets.size} svg asset(s), ${promotion.refusals.length} named refusal(s))`);
    const assetsDir = path.join(outDir, 'assets');
    if (promotion.assets.size > 0) {
      mkdirSync(assetsDir, { recursive: true });
      for (const [name, svg] of [...promotion.assets].sort()) {
        writeFileSync(path.join(assetsDir, `${name}.svg`), svg + '\n');
      }
    }
    const iconAssetsMerged = new Map([...iconAssets, ...promotion.assets]);
    const svgConsumedParts = new Set([...promotion.consumed].map((i) => aligned.partNames[i]));

    // ═══ CONFORMANCE FRONTIER (R3) — THE CAPTURE IS WRITTEN BEFORE ANYTHING
    // CAN REFUSE IT. captured-truth.json used to be written at the very END
    // of the component, after fusion and after generator validation — so a
    // component whose contract failed validation left NO MEASUREMENT AT ALL,
    // and neither a human nor the conformance fixture could tell what the
    // reader had actually seen. The block below depends on nothing
    // downstream of the promotion (verified: it references no fusion output),
    // so it runs here and the file lands on disk immediately. A QUARANTINED
    // component still ships its capture.

    // ---- captured-truth file (delta form; replay-sufficient) ----
    // Round 4 (v2): captures are encoded against the UNION anatomy —
    //   · present set == base parts → v1 delta-over-base (unchanged),
    //   · otherwise → offBase template encoding (anatomy carries per-part
    //     child templates + repStyle for off-base parts),
    //   · any capture the encoding cannot reproduce byte-equal → fullRoot
    //     (verified PER CAPTURE at write time, never trusted).
    const deltaVs = (el: FlatEl, ref: StyleMap): StyleMap => {
      const d: StyleMap = {};
      for (const p of run1.allProps) if (el.node.style[p] !== ref[p]) d[p] = el.node.style[p];
      return d;
    };
    const unionEntries = aligned.union.entries;
    const truthAnatomy = unionEntries.map((e, i) => {
      // child template from the introducing capture's interleave: text runs
      // from rep; element children = union children, rep-present ones in rep
      // order, others inserted at their union position.
      const repAligned = aligned.union.alignedByKey.get(e.repKey === '' ? `${space.baseComboKey}__default` : e.repKey)!;
      const idxOfChild = (u: typeof e) => unionEntries.indexOf(u);
      const presentInRep = new Set(e.children.filter((c) => repAligned[idxOfChild(c)]).map((c) => c.id));
      const template: Array<{ t: 'text'; v: string } | { t: 'el'; part: string }> = [];
      // walk rep nodes; map el children (in order) to rep-present union children
      const repPresentChildren = e.children.filter((c) => presentInRep.has(c.id));
      let elIdx = 0;
      const posOf = new Map<number, number>(); // union child id → template position
      for (const n of e.rep.nodes) {
        if (n.t === 'text') template.push({ t: 'text', v: n.v });
        else {
          const uc = repPresentChildren[elIdx++];
          if (uc) {
            posOf.set(uc.id, template.length);
            template.push({ t: 'el', part: uc.partName });
          }
        }
      }
      // insert non-rep children after their preceding union sibling
      for (let ci = 0; ci < e.children.length; ci++) {
        const uc = e.children[ci];
        if (presentInRep.has(uc.id)) continue;
        const prev = e.children.slice(0, ci).reverse().find((x) => posOf.has(x.id));
        const at = prev ? posOf.get(prev.id)! + 1 : 0;
        template.splice(at, 0, { t: 'el', part: uc.partName });
        posOf.set(uc.id, at);
        for (const [id, p] of posOf) if (id !== uc.id && p >= at) posOf.set(id, p + 1);
        posOf.set(uc.id, at);
      }
      return {
        part: aligned.partNames[i],
        path: e.repPath,
        signature: e.sig,
        tag: e.rep.tag,
        classes: e.rep.classes,
        join: aligned.anatomyJoin[i].join,
        ...(e.inBase ? {} : { inBase: false as const, repStyle: e.rep.style }),
        nodes: template,
      };
    });

    const baseIdxSet = new Set(unionEntries.map((e, i) => (e.inBase ? i : -1)).filter((i) => i >= 0));
    const baseStyleByIdx = new Map<number, StyleMap>();
    {
      const baseEls = aligned.getAligned(`${space.baseComboKey}__default`);
      baseEls.forEach((el, i) => { if (el) baseStyleByIdx.set(i, el.node.style); });
    }
    const view = (n: CapturedNode): unknown => ({
      tag: n.tag,
      nodes: n.nodes.map((c) => (c.t === 'text' ? c : { t: 'el', el: view(c.el) })),
      style: n.style,
      pseudo: n.pseudo,
    });
    const truthCaptures: TruthCaptureEntry[] = [];
    let fullRootCount = 0;
    for (const c of aligned.captures) {
      if (c.combo === space.baseComboKey && c.interaction === 'default') continue;
      const key = `${c.combo}__${c.interaction}`;
      const els = aligned.getAligned(key);
      const presentIdx = new Set(els.map((e, i) => (e ? i : -1)).filter((i) => i >= 0));
      const matchesBaseSet = presentIdx.size === baseIdxSet.size && [...presentIdx].every((i) => baseIdxSet.has(i));
      const entry: TruthCaptureEntry = {
        key,
        ...(c.focusVisibleMatched !== undefined ? { focusVisibleMatched: c.focusVisibleMatched } : {}),
      };
      const pseudoMap: Record<string, StyleMap> = {};
      els.forEach((e, i) => {
        if (!e) return;
        for (const [pe, st] of Object.entries(e.node.pseudo)) pseudoMap[`${aligned.partNames[i]}${pe}`] = st as StyleMap;
      });
      if (matchesBaseSet) {
        entry.elements = [...baseIdxSet].sort((a, b) => a - b).map((i) => ({
          part: aligned.partNames[i],
          delta: deltaVs(els[i]!, baseStyleByIdx.get(i)!),
        }));
      } else {
        entry.offBase = true;
        entry.elements = unionEntries.map((e, i) => ({
          part: aligned.partNames[i],
          delta: els[i] ? deltaVs(els[i]!, e.inBase ? baseStyleByIdx.get(i)! : e.rep.style) : null,
        }));
        // per-part text-run overrides vs the template (sr-only labels vary)
        const textOv: Record<string, string[]> = {};
        unionEntries.forEach((e, i) => {
          if (!els[i]) return;
          const repTexts = e.rep.nodes.filter((n) => n.t === 'text').map((n) => (n as { v: string }).v);
          const capTexts = els[i]!.node.nodes.filter((n) => n.t === 'text').map((n) => (n as { v: string }).v);
          if (JSON.stringify(repTexts) !== JSON.stringify(capTexts)) textOv[aligned.partNames[i]] = capTexts;
        });
        if (Object.keys(textOv).length > 0) entry.text = textOv;
      }
      if (Object.keys(pseudoMap).length > 0) entry.pseudo = pseudoMap;
      // PER-CAPTURE verification: the encoding must reproduce the capture
      // byte-equal or the capture falls back to fullRoot (named by count).
      const probeTruth: CapturedTruthFile = {
        _provenance: { channels: run1.allProps },
        anatomy: truthAnatomy as never,
        base: { key: `${space.baseComboKey}__default`, root: aligned.base.root },
        controls: {},
        captures: [entry],
      };
      const rebuilt = reconstructCaptures(probeTruth).find((r) => `${r.combo}__${r.interaction}` === key);
      if (!rebuilt || JSON.stringify(view(rebuilt.root)) !== JSON.stringify(view(c.root))) {
        delete entry.elements;
        delete entry.offBase;
        delete entry.pseudo;
        entry.fullRoot = c.root;
        fullRootCount++;
      }
      truthCaptures.push(entry);
    }
    if (fullRootCount > 0) console.log(`    truth encoding: ${fullRootCount}/${aligned.captures.length - 1} captures fell back to fullRoot (template could not reproduce them byte-equal)`);
    const capturedTruth: CapturedTruthFile = {
      _provenance: {
        generatedBy: 'extract/computed/run.ts',
        config: path.relative(REPO, CONFIG_PATH),
        component: comp.name,
        contract: comp.contract,
        library: `${cfg.library.package}@${cfg.library.version}`,
        browser: `Chromium ${run1.browserVersion} (playwright-core, headless)`,
        // The browser that measured `uaControls`. Same browser on a live
        // sweep; a BACKFILLED baseline (ua-baseline-backfill.ts) can name a
        // different one, and that has to be readable rather than assumed.
        uaBaselineBrowser: `Chromium ${run1.uaBaselineBrowser} (playwright-core, headless)`,
        viewport: cfg.browser.viewport,
        deviceScaleFactor: cfg.browser.deviceScaleFactor,
        colorScheme: cfg.browser.colorScheme,
        stage: stageFor(cfg, comp),
        sampleText: comp.sampleText,
        channelsEnumerated: run1.allProps.length,
        channels: run1.allProps,
        fontChecks: run1.fontChecks,
        determinism: determinismDetail,
        steadyState: 'transitions left ENABLED (freezing would alter captured transition-* channels); paint channels polled to stability across every stage element, bounded 600ms',
        ...(run1.pinnedAnimations.length > 0
          ? {
              animationPinning: `infinite CSS animations pinned at currentTime 0 (paused) — the captured value is each animation's own 0% keyframe, a deterministic point of the declared animation; finite animations/transitions untouched. Pinned: ${run1.pinnedAnimations.join(', ')}`,
            }
          : {}),
        // SHADOW-DOM ROUND — the descent receipt. Present only when the reader
        // actually crossed an open shadow boundary, so every light-DOM
        // library's provenance block is byte-unchanged.
        ...(Object.keys(run1.shadowHostTrails).length > 0
          ? {
              shadowDescent:
                'CAPTURED ROOT POLICY (shadow DOM): a custom-element HOST draws nothing of its own here (the published bundle ships no :host rules — the library\'s purgecss step deletes them), so the captured root is the first BOX-DRAWING element of its open shadow root and the host chain descended past is recorded per combo below. <slot> nodes are read as their assignedNodes() in rendered order; the host\'s light children are never walked directly, so slotted content is neither lost nor duplicated.',
              shadowHostTrails: Object.fromEntries(
                Object.entries(run1.shadowHostTrails).filter(([k]) => k.startsWith(`${comp.name}:`)),
              ),
            }
          : {}),
        interactionDrivers: comp.portalCapture
          ? {
              portalCapture: `baseline-diff portal reader (capture.portalSweep): the component's DOM contribution captured wherever React put it (portaled overlays included), one combo mounted at a time, DEFAULT interaction ONLY — overlay hover/focus/active states are a NAMED residual of the molecule round. Open-driver props: ${JSON.stringify(comp.openDriver ?? {})}`,
              ...(space.stateProps.length > 0 ? { [space.stateProps.map((s) => s.prop).join('+')]: 'prop-driven (rides the prop sweep)' } : {}),
            }
          : {
              formStateReset:
                'after every interaction capture, native input state mutated by the interaction itself (a click on an uncontrolled radio/checkbox checks it) is reset to mount defaults — interaction-caused form state never leaks across captures',
              hover: 'playwright locator.hover({force:true}) — pointer to element center',
              'focus-visible': 'sentinel.focus() + keyboard Tab (keyboard modality; matched state recorded per capture)',
              active: 'hover + mouse.down (held during capture) — honestly hover+active, what a user sees mid-press',
              ...(space.stateProps.length > 0 ? { [space.stateProps.map((s) => s.prop).join('+')]: 'prop-driven (rides the prop sweep)' } : {}),
            },
        enumerationPolicy: `${space.enumeration.policy} (${space.enumeration.combos.length} combos; cartesian ${space.enumeration.cartesianSize} vs limit ${cfg.enumeration.cartesianLimit}); ${space.enumeration.receipts.join('; ')}`,
        axesHeldFixed: space.heldFixed,
      },
      anatomy: truthAnatomy as never,
      base: { key: `${space.baseComboKey}__default`, root: aligned.base.root },
      controls: run1.controls,
      // THE UA BASELINE — the four control tags measured with none of the
      // library's CSS (capture.captureUaControls). `controls` above stays,
      // because the DIFFERENCE between the two is the evidence that a channel
      // came from the library's page-global CSS rather than from the browser.
      uaControls: run1.uaControls,
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
    writeFileSync(path.join(outDir, 'captured-truth.json'), JSON.stringify(capturedTruth) + '\n');

    // ---- EMOTION/CSS-VARS READER (MUI round): var-reference SOURCE bindings.
    // Per (part, channel): the custom-property each combo's matching CSS
    // declared, VERIFIED against the captured computed value (a var whose
    // resolved value is not what the element actually rendered is dropped by
    // name — cascade approximation can suggest, never assert). Uniform across
    // combos -> a `tokens` binding; a function of exactly one axis -> a
    // `tokensByProp` plane; anything else is a named skip. The var name maps
    // to the DTCG spelling mechanically (strip prefix, camelCase->kebab) and
    // only EXISTING DTCG leaves bind. Written as source-bindings.json for the
    // promote step; this run's own fusion is untouched.
    if (cfg.library.varPrefix) {
      const vp = cfg.library.varPrefix;
      // task #26: a DTCG tree nested under a wrapper group ("p") spells its
      // leaves `p.font-weight-medium` — prepend the declared group so the
      // mechanical mapping lands on the same path every committed ref uses.
      const groupPrefix = cfg.library.tokenGroup ? `${cfg.library.tokenGroup}.` : '';
      const tokenName = (varName: string): string =>
        groupPrefix + varName.slice(vp.length).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
      const dtcgNames = new Set(dtcgLeaves.map((l) => l.path));
      const colorTuple = (v: string): string | null => {
        // SCRIM ROUND: oklch AND oklab — a var whose value Chromium computes
        // to the cartesian spelling (every Tailwind v4 alpha-modified colour)
        // could not verify against its own declaration before, so the token
        // NAME was lost alongside the value.
        const ok = okColorToRgba(v.trim());
        if (ok) return `${ok.r},${ok.g},${ok.b},${ok.a}`;
        const m = /^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/.exec(v);
        if (m) return `${m[1]},${m[2]},${m[3]},${Number(m[4] ?? 1)}`;
        let s6 = v.trim();
        const h3 = /^#([0-9a-f]{3,4})$/i.exec(s6);
        if (h3) s6 = '#' + [...h3[1]].map((c) => c + c).join('');
        const h = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s6);
        if (h) {
          const n = parseInt(h[1], 16);
          return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${h[2] ? Math.round((parseInt(h[2], 16) / 255) * 10000) / 10000 : 1}`;
        }
        return null;
      };
      const valueEq = (raw: string, computed: string): boolean => {
        if (raw === computed) return true;
        const ct = colorTuple(raw); if (ct) return ct === colorTuple(computed);
        const rem = /^(-?[\d.]+)rem$/.exec(raw);
        if (rem) return `${Number((Number(rem[1]) * 16).toFixed(4))}px` === computed;
        return false;
      };
      type Fact = { token: string; varName: string; selector: string };
      /** fix 1: the shorthand ceiling — one named line per dropped source
       *  declaration, deduplicated across combos (the same rule matches every
       *  combo; the LOSS is per declaration, not per combo). */
      const shorthandSkips = new Set<string>();
      /** R5: property -> named calc skip, per part. Recorded for EVERY calc()
       *  declaration carrying a var(); emitted only for the channels no
       *  candidate verified (an identity calc that DID verify is a recovered
       *  token name, not a loss). */
      const calcSkips = new Map<string, string>(); // `${part}|${channel}` -> message
      const perPart = new Map<string, Map<string, Map<string, Fact | null>>>(); // part -> channel -> comboKey -> fact
      for (let pi = 0; pi < aligned.baseFlat.length; pi++) {
        const partName = aligned.partNames[pi];
        for (const combo of space.enumeration.combos) {
          const el = aligned.getAligned(`${combo.key}__default`)[pi];
          // fix 1: shorthand-carried var refs never had a computed value to
          // verify against — they are the ceiling, named here.
          for (const [prop, names] of Object.entries(el?.node.vshorthands ?? {})) {
            shorthandSkips.add(shorthandVarSkip(partName, prop, names));
          }
          // R5: the calc ceiling, recorded per (part, channel).
          for (const [prop, decls] of Object.entries(el?.node.vcalcs ?? {})) {
            for (const [names, text] of decls) calcSkips.set(`${partName}|${prop}`, calcVarSkip(partName, prop, names, text));
          }
          if (!el?.node.vrefs) continue;
          for (const [ch, cands] of Object.entries(el.node.vrefs)) {
            if (el.node.style[ch] === undefined) {
              // SILENT-LOSS ROUND (task #33, fix 1): this was a bare
              // `continue`. Nothing reached `skips`, so source-bindings.json
              // reported `skips: []` and the console printed `0 named
              // skip(s)` — the artifact ASSERTED COMPLETENESS over a loss it
              // had just taken. Every dropped declaration is now named, and
              // the COUNT is the size of the shorthand ceiling (task #27).
              shorthandSkips.add(shorthandVarSkip(partName, ch, (cands as Array<[string, string, string?]>).map((c) => c[0])));
              continue;
            }
            if (!perPart.has(partName)) perPart.set(partName, new Map());
            const chans = perPart.get(partName)!;
            if (!chans.has(ch)) chans.set(ch, new Map());
            // pick the candidate that VERIFIES against the captured computed
            // value AND names an existing DTCG leaf (specificity is not
            // document order; verification decides). Ties are value-identical
            // by construction — sorted-first, deterministic.
            // FLUENT 2 (H3): a ONE-HOP candidate (4th element `1`) is offered
            // in ADDITION to the direct name, never instead of it, and sorts
            // AFTER every direct candidate. So recovering a name behind a
            // component-local variable can only fill a channel that bound
            // nothing — it can never demote a semantic alias the library
            // named directly to the primitive sitting behind it. Committed
            // captures carry no 4th element, so this key is 0 for all of them
            // and the existing alphabetical order is untouched.
            const verified = cands
              .map(([varName, raw, selector, hop]) => ({ token: tokenName(varName), varName, raw, selector: selector ?? '', hop: hop ? 1 : 0 }))
              .filter((c) => dtcgNames.has(c.token) && valueEq(c.raw, el.node.style[ch]))
              .sort((a, b) => a.hop - b.hop || a.token.localeCompare(b.token));
            chans.get(ch)!.set(combo.key, verified.length > 0 ? { token: verified[0].token, varName: verified[0].varName, selector: verified[0].selector } : null);
          }
        }
      }
      // FACTS, not factored bindings: the minted per-pair leaves already
      // encode axis conditioning in their NAMES (imported.button.root.
      // background-color.contained.primary) — the promote step ALIASES each
      // minted leaf to the source-named token when every combo the leaf
      // covers agrees (DTCG-native aliasing; value equality is already
      // verified per fact, so the alias cannot change a rendered pixel).
      const srcFacts: Array<{ part: string; channel: string; combo: string; axisValues: Record<string, string>; token: string; varName: string; anchor: { selector: string } }> = [];
      const srcSkips: string[] = [];
      for (const [partName, chans] of [...perPart].sort()) {
        for (const [ch, byCombo] of [...chans].sort()) {
          const okCount = [...byCombo.values()].filter(Boolean).length;
          if (okCount === 0) {
            // R6 (WRONG-NAME) — THE MESSAGE USED TO COLLAPSE EVERY CAUSE INTO
            // ONE. "no var candidate verified against the computed value in
            // any combo" is true of a two-hop semantic alias, of a token that
            // is simply absent from the DTCG file, and of a genuine value
            // disagreement — three different defects with three different
            // remedies, reported identically. That is exactly the condition
            // that hid Carbon's hollow checkbox. The cause is now named.
            const calc = calcSkips.get(`${partName}|${ch}`);
            if (calc) { srcSkips.push(calc); continue; }
            const cands = new Map<string, { raw: string; matches: boolean }>();
            for (const combo of space.enumeration.combos) {
              const el = aligned.getAligned(`${combo.key}__default`)[aligned.partNames.indexOf(partName)];
              const computed = el?.node.style[ch];
              for (const [varName, raw] of ((el?.node.vrefs?.[ch] ?? []) as Array<[string, string, string?]>)) {
                if (!cands.has(varName)) cands.set(varName, { raw, matches: computed !== undefined && valueEq(raw, computed) });
              }
            }
            const named = [...cands].sort(([a], [b]) => a.localeCompare(b));
            const inDtcg = named.filter(([v]) => dtcgNames.has(tokenName(v)));
            if (named.length === 0) {
              srcSkips.push(`${partName}.${ch}: the matching rules reference no var() the reader could resolve — no candidate to verify`);
            } else if (inDtcg.length === 0) {
              const valueRight = named.filter(([, c]) => c.matches);
              srcSkips.push(
                `${partName}.${ch}: candidate${named.length > 1 ? 's' : ''} ${named.map(([v, c]) => `${v} → "${tokenName(v)}" = ${c.raw}${c.matches ? ' (value MATCHES the computed value)' : ' (value differs)'}`).join('; ')} — no candidate names a leaf of this library's DTCG token file, so there is no NAME to bind.` +
                (valueRight.length > 0
                  ? ` The VALUE is right and only the NAME is unrecoverable: this is the shape of a semantic-over-primitive INDIRECTION (the referenced custom property is itself defined as var(<primitive>)), and the reader follows exactly ONE hop — the primitive behind the alias is never reached.`
                  : ''),
              );
            } else {
              srcSkips.push(
                `${partName}.${ch}: candidate${inDtcg.length > 1 ? 's' : ''} ${inDtcg.map(([v, c]) => `${v} → "${tokenName(v)}" = ${c.raw}`).join('; ')} name${inDtcg.length > 1 ? '' : 's'} a DTCG leaf but the resolved value does NOT equal the captured computed value in any combo — the cascade approximation suggested a token the element did not render; binding dropped by name`,
              );
            }
            continue;
          }
          for (const combo of space.enumeration.combos) {
            const f = byCombo.get(combo.key);
            if (f) srcFacts.push({ part: partName, channel: ch, combo: combo.key, axisValues: combo.axisValues, token: f.token, varName: f.varName, anchor: { selector: f.selector } });
          }
        }
      }
      // R5: a calc()-carried var() on a property that never reached the
      // per-channel table at all (a custom-property definition, a property the
      // computed sweep does not enumerate) would otherwise be counted and
      // never named. Named here, so `calcDeclarations` and the skip list can
      // never disagree about a loss.
      {
        const verified = new Set(srcFacts.map((f) => `${f.part}|${f.channel}`));
        for (const [key, msg] of [...calcSkips].sort()) {
          if (verified.has(key)) continue;
          if (!srcSkips.includes(msg)) srcSkips.push(msg);
        }
      }
      // R5: calc declarations on channels that DID verify are not losses —
      // the token name was recovered through the calc. Only the unverified
      // ones are skips, and those are pushed above. The COUNT of calc
      // declarations seen is reported either way, so "the reader saw no
      // calc()" and "the reader saw calc() and recovered every name" are
      // different, visible facts.
      const calcSeen = calcSkips.size;
      const calcLost = srcSkips.filter((sk) => sk.includes('the calc ceiling')).length;
      const shorthandSkipList = [...shorthandSkips].sort();
      writeFileSync(path.join(outDir, 'source-bindings.json'), JSON.stringify({
        _marker: 'EMOTION/CSS-VARS READER — SOURCE facts: the library\'s own emitted CSS named these tokens (var references verified against captured computed values, one indirection hop followed). The promote step aliases matching minted leaves; never auto-applied here.',
        component: comp.name,
        varPrefix: vp,
        facts: srcFacts,
        skips: srcSkips,
        // fix 1 (task #33): source declarations dropped because the property
        // they name is not in the computed longhand sweep — overwhelmingly
        // SHORTHANDS carrying a var(). This count IS the shorthand ceiling
        // (task #27) for this component; `skips: []` used to be printed over
        // it.
        shorthandCeiling: shorthandSkipList.length,
        shorthandSkips: shorthandSkipList,
        // R5 (calc ceiling): how many (part, channel) pairs the reader saw a
        // calc()-carried var() on, and how many of those lost the name.
        calcDeclarations: calcSeen,
        calcCeiling: calcLost,
        // SILENT-LOSS ROUND — the READ BOUNDARY. Both of the reader's
        // stylesheet reads used to swallow a throw (`catch {}` and
        // `catch { continue; }`), so a cross-origin <link> — which exposes no
        // cssRules at all — vanished whole while this file printed `skips: []`.
        // "The reader found no source facts" and "the reader could not look"
        // are different facts, and only one of them is the library's fault.
        // Empty on every committed library (all same-origin), so no bytes move.
        stylesheetCeiling: run1.stylesheetSkips.length,
        stylesheetSkips: run1.stylesheetSkips,
      }, null, 2) + '\n');
      console.log(`    source-bindings: ${srcFacts.length} verified fact(s) over ${new Set(srcFacts.map((f) => `${f.part}.${f.channel}`)).size} channel(s), ${srcSkips.length} named skip(s), ${shorthandSkipList.length} shorthand-ceiling skip(s), ${calcSeen} calc() declaration(s) (${calcLost} lost the token name), ${run1.stylesheetSkips.length} UNREADABLE stylesheet(s)`);
    }

    const controlStyles = Object.fromEntries(Object.entries(run1.controls).map(([t, n]) => [t, n.style]));
    const styledReceipts: string[] = [];
    // task #20: fusion is told what the capture WINDOW and the stage were, so
    // a measurement of the harness cannot pass for a measurement of the
    // library (viewport-derived geometry is refused by name in styledChannels).
    const uaControlStyles = Object.fromEntries(Object.entries(run1.uaControls).map(([t, n]) => [t, n.style]));
    const styled = styledChannels(aligned, space, controlStyles, run1.allProps, styledReceipts, {
      viewport: cfg.browser.viewport,
      stage: stageFor(cfg, comp),
      portaled: comp.portalCapture === true,
    }, uaControlStyles);

    // ---- fusion (against the PROMOTED contract) ----
    console.log('  phase 2 — fusion…');
    const folds = detectFolds(aligned, styled, styledReceipts);
    const { rows: boundRows, untriaged } = await boundCheck(aligned, comp, space, probeToken, promotion.contract);
    const boundConfirmed = boundRows.filter((r) => r.verdict === 'confirmed').length;
    const contradictions = boundRows.filter((r) => r.verdict === 'contradiction');
    console.log(`    bound: ${boundConfirmed}/${boundRows.length} confirmed · ${contradictions.length} contradictions (${untriaged.length} untriaged) · ${folds.length} folds`);

    const layout = enrichLayout(aligned, space, styled, promotion.contract);
    const prep = prepareMint(aligned, comp, space, styled, folds, layout.handled, promotion.contract, svgConsumedParts, new Set(promotion.partIndex.keys()), promotion.gridMintRefusals);
    // ORPHAN-LEAF ROUND (task #42): the refusals ride the styled-channel
    // receipt channel into the extension block AND the ledger, so the count of
    // leaves a refused part did NOT mint is legible per component. A silent
    // zero and a door that is not wired must not look the same.
    styledReceipts.push(...prep.orphanRefusals);
    if (prep.orphanRefusals.length > 0) {
      console.log(`    orphan-mint door: ${prep.orphanRefusals.length} promotion-refused part(s) mint nothing (task #42)`);
    }
    // Round 5c: carried-channel re-mints (defaultless-axis contest) ride the
    // styled-channel receipts into the extension block + the ledger.
    styledReceipts.push(...prep.remintReceipts);
    // Inheritance-aware refusal (nested-state repair round): the MEASURED
    // pure-inheritance findings ride the same receipt channel, so both the
    // dropped bindings and the near-misses that were checked and KEPT are
    // legible in the extension block and the ledger.
    styledReceipts.push(...prep.inheritanceReceipts);
    // nestedPairs: applyMintToContract can spell a nested pair as a
    // per-value tokensByProp map (state-plane projection round).
    const mintBase = mintTokens(comp.name, prep.baseObs, prep.axes, { nestedPairs: true });
    const mintStates = mintTokens(comp.name, prep.stateObs, prep.axes, { nestedPairs: true });
    const { enriched, overflowBindings, enrichmentNotes } = applyMintToContract(
      promotion.contract, space, mintBase, prep.baseObs, mintStates, prep.stateObs, layout.enriched,
      prep.declared, prep.declaredStates, prep.setPlaneLiterals,
      { only: prep.inheritanceOnly, stateDeltas: prep.inheritanceStateDeltas },
      prep.stateCodeOnly,
    );

    // task #37 — SIZING EVIDENCE for the max-width channel. A part that
    // carries max-width and was MEASURED hugging beneath it (used width
    // strictly below the cap, in every combo) records that fact; the Figma
    // emitter reads it to bind maxWidth as a real ceiling instead of baking
    // a fixed width. No measurement ⇒ no field ⇒ unchanged lowering.
    const hugs = hugEvidence(aligned, space);
    enrichmentNotes.push(...hugs.receipts);
    for (const { name, part } of walkAnatomy(enriched as Contract)) {
      const carries =
        (part.tokens && 'max-width' in part.tokens) ||
        (part.declared && 'max-width' in part.declared) ||
        (part.literals && 'max-width' in part.literals);
      if (!carries) continue;
      const verdict = hugs.hugs.get(name);
      if (verdict === undefined) {
        enrichmentNotes.push(
          `hug-evidence-absent: ${name} carries max-width but the capture produced no uniform pixel measurement for it — no sizing evidence carried (the max-width lowering is unchanged).`,
        );
        continue;
      }
      if (verdict) {
        part.hugsBelowMaxWidth = true;
        enrichmentNotes.push(
          `sizing evidence carried: ${name}.hugsBelowMaxWidth = true (MEASURED — the used width stayed strictly below the max-width cap in every enumerated combo, so the max-width is a CEILING the box hugs beneath, not a design width)`,
        );
      } else {
        enrichmentNotes.push(
          `sizing evidence measured, NOT carried: ${name} sits AT its max-width in every combo — the value may be a genuine design width, so the fixed-width lowering stands.`,
        );
      }
    }

    // MINT ROUND (2026-08-25) — TEXT EVIDENCE for the text-indent channel.
    // An element whose carried `text-indent` was MEASURED laying its first
    // line entirely outside its own content box paints NO text there; the
    // canvas emitter reads this to draw no text child on exactly those
    // combos instead of drawing the label at indent 0 (which is ink the
    // library never shows). No measurement ⇒ no field ⇒ unchanged lowering.
    const offBox = textOutOfBoxEvidence(aligned, space);
    enrichmentNotes.push(...offBox.receipts);
    for (const { name, part } of walkAnatomy(enriched as Contract)) {
      const carries =
        (part.tokens && 'text-indent' in part.tokens) ||
        (Array.isArray(part.tokensByProp)
          ? part.tokensByProp
          : part.tokensByProp
            ? [part.tokensByProp]
            : []
        ).some((t) => Object.values(t.map).some((m) => 'text-indent' in m)) ||
        (part.declared && 'text-indent' in part.declared) ||
        (part.literals && 'text-indent' in part.literals);
      if (!carries) continue;
      const verdict = offBox.outOfBox.get(name);
      if (verdict === undefined) continue;
      // The flag qualifies TEXT. A part that carries no text of its own has
      // no label for the canvas to withhold (validateContract refuses the
      // field there), so the measurement is receipted and not carried.
      if (part.text === undefined && part.content === undefined) {
        enrichmentNotes.push(
          `text-indent-off-box measured, NOT carried: ${name}'s first line lands outside its box, but the part carries no text of its own — nothing for the canvas to withhold.`,
        );
        continue;
      }
      part.textOutOfBox = verdict;
      enrichmentNotes.push(
        `text evidence carried: ${name}.textOutOfBox = ${JSON.stringify(verdict)} (MEASURED — text-indent lays the first line at or past the content-box end edge${verdict.prop ? ` on ${verdict.prop} = ${(verdict.values ?? []).join(', ')}` : ' in every enumerated combo'}, so the browser paints no text in the box and the canvas draws none either)`,
      );
    }

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
    validateContract(enriched as Contract, new Map([[enriched.id, enriched as Contract]]), validationErrors, iconAssetsMerged);
    if (validationErrors.length > 0) {
      console.log(`    ✖ validateContract: ${validationErrors.length} error(s)`);
      for (const e of validationErrors.slice(0, 8)) console.log(`      - ${e}`);
      // R3: scoped to THIS component. The whole library used to stop here.
      throw new QuarantineError(
        `${comp.name}: enriched contract failed generator validation (${validationErrors.length} error(s))`,
        validationErrors,
      );
    }

    // ---- Round 4: re-apply committed HUMAN-ACKED decisions (resolve.ts
    // ledger) onto the freshly fused contract — the gate must score the
    // resolved bindings, not contradictions a human already resolved. The
    // generated enriched.contract.json stays byte-reproducible; the applied
    // result lands in resolved.contract.json (the promotion source).
    const decisionsPath = path.join(outDir, 'decisions.json');
    let gated = enriched as Contract;
    let decisionNotes: string[] = [];
    if (existsSync(decisionsPath)) {
      const decisions = JSON.parse(readFileSync(decisionsPath, 'utf8')) as AckedDecision[];
      const resolved = structuredClone(enriched) as Contract;
      // Apply-time value check: the SAME inventory the gate renders with —
      // now literally the same function (gate.ts gateInventory: cfg.tokens
      // .dtcg + the fresh mint + the SHIPPED minted tree), so an acked
      // resolution that cannot resolve is refused by name instead of
      // rendering empty, and the two referees cannot drift apart. Measured
      // no-op at the time it landed: no committed ledger in any of the four
      // libraries targets an `imported.*` ref (pinned by
      // decision-ledger-value-check), so the widened inventory admits
      // nothing new today — it removes a twin of the gate defect.
      const { inventory: decisionInventory } = gateInventory(REPO, cfg, mergedTree);
      const { applied, skipped } = applyDecisions(resolved, decisions, decisionInventory);
      decisionNotes = [
        ...applied.map((a) => `decision re-applied: ${a}`),
        ...skipped.map((sk) => `decision SKIPPED: ${sk}`),
      ];
      ContractSchema.parse(resolved);
      const resolvedErrors: string[] = [];
      validateContract(resolved, new Map([[resolved.id, resolved]]), resolvedErrors, iconAssetsMerged);
      if (resolvedErrors.length > 0) {
        throw new QuarantineError(
          `${comp.name}: decision-applied contract fails generator validation (${resolvedErrors.length} error(s))`,
          resolvedErrors,
        );
      }
      writeFileSync(path.join(outDir, 'resolved.contract.json'), JSON.stringify(resolved, null, 2) + '\n');
      gated = resolved;
      console.log(`    decisions: ${applied.length} re-applied${skipped.length ? `, ${skipped.length} SKIPPED (named)` : ''} → resolved.contract.json (the gated + promoted artifact)`);
    }

    const pseudo = pseudoFindings(aligned, cfg.library.classPrefix);

    // ═══ CONFORMANCE FRONTIER — the round's READ-BOUNDARY receipts ═══
    // Every one of these is a fact the pipeline used to take in silence.
    const pseudoRead = new Map<string, Set<string>>(); // pseudo -> parts
    for (const c of aligned.captures) {
      for (const [pi, el] of aligned.getAligned(`${c.combo}__${c.interaction}`).entries()) {
        for (const pe of Object.keys(el?.node.pseudo ?? {})) {
          (pseudoRead.get(pe) ?? pseudoRead.set(pe, new Set()).get(pe)!).add(aligned.partNames[pi] ?? `el@${pi}`);
        }
      }
    }
    // SCOPE-INDEPENDENCE ROUND (task #45) — THIS COMPONENT'S read-boundary
    // facts, not the run's. `run1.textFillFolds` / `run1.closedShadowSuspects`
    // used to be flat, run-wide accumulators spliced WHOLE into every
    // component's receipts, so `--component Button` alone and `Button` inside
    // a full-library sweep wrote DIFFERENT LEDGER.md and
    // enriched.extension.json bytes for the same component (measured: Carbon
    // 380 lines, MUI 80). They are now keyed by component, exactly like
    // `shadowHostTrails`, and only this component's own lines are read.
    const myFolds = run1.textFillFolds[comp.name] ?? [];
    const mySuspects = run1.closedShadowSuspects[comp.name] ?? [];
    const frontierReceipts: string[] = [
      ...myFolds,
      ...mySuspects,
      // The portal path (capturePortalRoots) normalizes inside its own reader
      // and never calls readBoundaryReceipts, so for a portalCapture component
      // ZERO lines above means NOT READ, not "none found". Scoping the
      // accumulators made that distinction visible; stating it is the receipt
      // the scoping owes (before, a portal component silently displayed its
      // SIBLINGS' folds and looked read).
      ...(comp.portalCapture
        ? [
            `read-boundary-not-read-on-portal-path: ${comp.name} sweeps through capturePortalRoots (two-phase baseline diff), which normalizes each root inside its own reader and never runs readBoundaryReceipts — so the text-fill fold and the closed-shadow-root signature are NOT MEASURED for this component. Zero lines above means UNREAD, not "none found"; a named residual of the molecule round, surfaced by the scope-independence fix (before it, this component displayed its SIBLINGS' folds and looked read).`,
          ]
        : []),
      // R8 — THE CLOSED-SHADOW-ROOT LIMIT, STATED WHETHER OR NOT ONE FIRED.
      // `el.shadowRoot` is null for a closed root, so a host's entire rendered
      // interior is unreachable from script and the host is captured as an
      // EMPTY LEAF. Two signatures of that ABSENCE are detectable and named
      // per element above; the third case is NOT, and saying so is the
      // receipt. MEASURED on the fixture's own subject: a closed root attached
      // to a plain <span> inside a display:flex parent — the parent BLOCKIFIES
      // the host, so its computed display is `block` and its 51.22x14 box is
      // content-sized by a flex parent, which is byte-for-byte
      // indistinguishable from an ordinary empty flex item. The only decisive
      // probe is `attachShadow()` throwing NotSupportedError on an element
      // that is already a host — and on the NEGATIVE path that call ATTACHES
      // an empty open root, mutating the page mid-sweep and breaking the
      // double-run byte-identity self-check. Refused for that reason, by
      // name, rather than overlooked.
      `closed-shadow-root-limit: ${mySuspects.length} suspected closed shadow root(s) named above. A closed shadow root is UNREACHABLE from script (el.shadowRoot === null), so nothing about a closed host's interior is captured or carried; the reader names the two signatures of its absence it can see (a custom-element leaf that paints a box; a non-replaced display:inline leaf with a non-zero content box) and NAMES AS UNDETECTABLE the third — a closed root on a plain element blockified by a flex/grid parent, which no computed style distinguishes from an empty item. The decisive probe (attachShadow throwing NotSupportedError) mutates the page on its negative path and would break the double-run byte-identity self-check; it is refused, not forgotten.`,
      `pseudo-elements-read: the reader looks at ${READ_PSEUDOS.join(', ')} — measured here on ${[...pseudoRead].sort().map(([pe, parts]) => `${pe} (${parts.size} part(s))`).join(', ') || 'no part'}. Reading is not carrying: the bounded decor grammar promotes ${DECOR_PSEUDOS.join('/')} only, so every other pseudo the reader records is a MEASUREMENT with no carriage — named, never silently dropped.`,
      ...REFUSED_PSEUDOS.map(([pe, why]) => `pseudo-element-not-read: ${pe} — REFUSED BY NAME, not measured: ${why}`),
      `pseudo-elements-refused: ${REFUSED_PSEUDOS.length} (${REFUSED_PSEUDOS.map(([pe]) => pe).join(', ')})`,
    ];
    for (const r of frontierReceipts) console.log(`    frontier: ${r.slice(0, 150)}`);

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
      declaredFacts: {
        _note: 'v15 (S4): uniform registry-channel facts carried as Part.declared / Part.declaredStates — first-class contract vocabulary, listed here as the enrichment receipt',
        base: prep.declared,
        state: prep.declaredStates,
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
      // SILENT-LOSS ROUND: parts observed only on an INTERACTION plane. The
      // base pass refuses them as "interaction-only"; the state round has no
      // default-plane counterpart to diff against and drops them. Neither end
      // carries the channel, so the loss is stated at both — the base receipt
      // used to say "state rounds own it", which sent the reader to the door
      // that discards it.
      interactionOnlyPlaneDrops: prep.planeAbsentDrops.slice(0, 20),
      interactionOnlyPlaneDropCount: prep.planeAbsentDrops.length,
      structureReceipts: [...new Set([...aligned.structureReceipts, ...(portalReceipts.get(comp.name) ?? [])])],
      styledChannelReceipts: styledReceipts,
      // CONFORMANCE FRONTIER (task #36): the read-boundary receipts — the
      // painted-ink fold, the closed-shadow-root signature, and the pseudo-
      // element reader's declared frontier (read vs refused-by-name).
      frontierReceipts,
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


    // ---- phase 3: truth replay + pixel ----
    console.log('  phase 3 — truth replay…');
    const replaySpecs: ReplaySpec[] = aligned.captures.map((c) => ({ key: `${c.combo}__${c.interaction}`, root: c.root }));
    const replayPath = path.join(outDir, 'replay.html');
    writeFileSync(replayPath, buildReplayHtml(replaySpecs, stageFor(cfg, comp), cfg.browser.colorScheme));
    const replayPage = await context.newPage();
    await replayPage.goto(`file://${replayPath}`);
    await replayPage.waitForFunction('window.__READY === true');
    await replayPage.evaluate('document.fonts.ready');
    await replayPage.waitForTimeout(200);
    const reread = await rereadEquality((js) => replayPage.evaluate(js), replaySpecs, run1.allProps);

    // SILENT-LOSS ROUND (task #33, fix 5) — see extract/computed/gate.ts. The
    // replay roll-up had the SAME defect and one worse: gate.ts at least
    // excluded the "original screenshot unavailable" rows from its
    // denominator, while this one counted them at the fabricated 100 in the
    // mean, the max and the perfect-count — a NUMBER for a row whose own note
    // said "pixel not scored". The two roll-ups of the same concept now agree.
    interface PixelRow { key: string; pctExact: number | null; pctAA: number | null; unscorable?: 'size-mismatch' | 'no-original'; note?: string }
    const pixelRows: PixelRow[] = [];
    const replayShots = path.join(outDir, '.replay-shots');
    mkdirSync(replayShots, { recursive: true });
    for (const spec of replaySpecs) {
      const loc = replayPage.locator(`[data-replay="${spec.key}"]`);
      await loc.scrollIntoViewIfNeeded();
      const shot = await loc.screenshot({ timeout: 10_000 });
      writeFileSync(path.join(replayShots, `${spec.key}.png`), shot);
      const origPath = path.join(scratchShots, `${comp.name}--${spec.key}.png`);
      if (!existsSync(origPath)) {
        // portal combos whose root pick could not be screenshotted — named
        pixelRows.push({ key: spec.key, pctExact: null, pctAA: null, unscorable: 'no-original', note: 'original screenshot unavailable — pixel not scored' });
        continue;
      }
      const a = PNG.sync.read(readFileSync(origPath));
      const b = PNG.sync.read(shot);
      if (a.width !== b.width || a.height !== b.height) {
        pixelRows.push({ key: spec.key, pctExact: null, pctAA: null, unscorable: 'size-mismatch', note: `size mismatch ours ${b.width}x${b.height} vs orig ${a.width}x${a.height} — NOT SCORED (pixelmatch cannot run across sizes; a wrong-sized box is a geometry failure, not a percentage)` });
        continue;
      }
      const total = a.width * a.height;
      const diffExact = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0, includeAA: true });
      const diffAA = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0.1 });
      pixelRows.push({ key: spec.key, pctExact: (100 * diffExact) / total, pctAA: (100 * diffAA) / total });
    }
    // an UNSCORED row sorts to the top: nothing could be measured at all.
    const worst = [...pixelRows].sort((x, y) => (y.pctAA ?? 101) - (x.pctAA ?? 101) || (y.pctExact ?? 101) - (x.pctExact ?? 101)).slice(0, 8);
    const pxComparable = pixelRows.filter((r) => r.unscorable !== 'no-original');
    const pxMeasured = pxComparable.filter((r) => r.pctExact !== null && r.pctAA !== null) as Array<PixelRow & { pctExact: number; pctAA: number }>;
    // NULL, never 0: in this metric 0 means PERFECT, so an empty mean printed
    // as 0 would report the best possible score for a component nothing could
    // be measured on.
    const mean = (pick: (r: { pctExact: number; pctAA: number }) => number) =>
      pxMeasured.length === 0 ? null : pxMeasured.reduce((n, r) => n + pick(r), 0) / pxMeasured.length;
    await replayPage.close();

    // ---- phase 4: the fidelity gate (contract-mediated) ----
    console.log('  phase 4 — fidelity gate (enriched contract → emit-html vs original)…');
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
      origShotsDir: scratchShots,
      outDir,
      browserVersion: run1.browserVersion,
      iconAssets: iconAssetsMerged,
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
      contextStyles: run1.controls['span']?.style ?? {},
    });
    await gatePage.close();

    // ---- paired receipts (owner directive: SELF-EXPLANATORY — each half
    // labeled in the image margin). LEFT = the real npm package render,
    // RIGHT = the CONTRACT render (enriched contract → emit-html), i.e. the
    // owner-facing one-to-one claim. Keys: base, one hover, one focus, the
    // worst gate row, and (round 4) one all-presence-on combo. ----
    const receiptsDir = path.join(outDir, 'receipts');
    mkdirSync(receiptsDir, { recursive: true });
    const allOnCombo = space.enumeration.combos.find(
      (c) =>
        Object.values(c.stateFlags).every((f) => !f) &&
        [...space.presence.keys()].every((pp) => c.axisValues[pp] === 'on') &&
        space.axes.filter((ax) => !space.presence.has(ax.prop)).every((ax) => c.axisValues[ax.prop] === space.baseAxisValues[ax.prop]),
    );
    const worstGate = [...scorecard.rows].sort((x, y) => (y.pctAA ?? 101) - (x.pctAA ?? 101))[0];
    const receiptKeys = [...new Set([
      `${space.baseComboKey}__default`,
      ...(allOnCombo ? [`${allOnCombo.key}__default`] : []),
      `${space.baseComboKey}__hover`,
      `${space.baseComboKey}__focus-visible`,
      worstGate?.key,
    ])].filter((x): x is string => Boolean(x));
    for (const key of receiptKeys) {
      const aPath = path.join(scratchShots, `${comp.name}--${key}.png`);
      const bPath = path.join(outDir, 'gate-shots', `${key}.png`);
      if (!existsSync(aPath) || !existsSync(bPath)) continue;
      const a = PNG.sync.read(readFileSync(aPath));
      const b = PNG.sync.read(readFileSync(bPath));
      const outPng = labeledPair(a, b, 'REAL POLARIS (NPM PACKAGE)', 'CONTRACT RENDER (EMIT-HTML)');
      writeFileSync(path.join(receiptsDir, `pair--${key}.png`), PNG.sync.write(outPng));
    }

    // ---- `--keep-originals`: commit the REAL LIBRARY render, un-collaged.
    //
    // Why this flag exists. `gate-shots/<key>.png` is the CONTRACT RENDER
    // (enriched contract → emit-html) — the RIGHT half of the pair above. The
    // real npm-package render lives only in `scratchShots`, which this file
    // deletes on the way out, so the ONLY library pixels the pipeline has ever
    // committed are baked into a labeled side-by-side collage at a handful of
    // keys. Every console-loop lane that scores "canvas vs DEVELOPED" against a
    // `gate-shots/` file is therefore scoring the canvas against ANOTHER
    // EMITTER'S RENDER OF THE SAME CONTRACT, not against the library: a real
    // measurement (two emitters, two renderers), but not the one its name
    // claims, and one that cannot fall when the contract is wrong in the same
    // way on both sides. A lane cannot be honest about fidelity to a library
    // whose pixels it never keeps.
    //
    // Default OFF: no committed artifact moves for any library until a round
    // deliberately asks for the originals.
    if (KEEP_ORIGINALS) {
      const origDir = path.join(outDir, 'orig-shots');
      mkdirSync(origDir, { recursive: true });
      let kept = 0;
      for (const combo of space.enumeration.combos) {
        for (const inter of INTERACTIONS) {
          const key = `${combo.key}__${inter}`;
          const from = path.join(scratchShots, `${comp.name}--${key}.png`);
          if (!existsSync(from)) continue;
          writeFileSync(path.join(origDir, `${key}.png`), readFileSync(from));
          kept++;
        }
      }
      console.log(`  --keep-originals: ${kept} REAL-LIBRARY screenshot(s) → ${path.relative(process.cwd(), origDir)} (gate-shots/ is the CONTRACT render, not this)`);
    }

    // ---- artifacts ----
    // NOT MEASURED prints as words, never as a number — a null rendered as
    // "0.000%" in this metric would read as PERFECT (fix 5).
    const fmt = (n: number | null) => (n === null ? 'NOT MEASURED' : `${n.toFixed(3)}%`);
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
      declared: { base: prep.declared.length, state: prep.declaredStates.length },
      codeOnly: { base: prep.codeOnly.length, state: prep.stateCodeOnly.length, overflowBindings: overflowBindings.length },
      pseudoElementFindings: pseudo.length,
      anatomyPromotion: {
        partsCarried: promotion.partIndex.size,
        svgAssets: promotion.assets.size,
        refusals: promotion.refusals.length,
      },
      enrichedContractSchemaValid: true,
      enrichedContractGeneratorValid: true,
      replayComputedEquality: reread,
      pixel: {
        pairs: pxComparable.length,
        measured: pxMeasured.length,
        unscored: {
          sizeMismatch: pxComparable.filter((r) => r.unscorable === 'size-mismatch').length,
          noOriginal: pixelRows.filter((r) => r.unscorable === 'no-original').length,
          note: 'sizeMismatch: pixelmatch cannot run across sizes — counted in `pairs` (a failed pair), never `perfect`, NOT averaged. noOriginal: there was never a pair — excluded from `pairs`. Both COUNTED here; they used to be scored 100 and averaged as if measured.',
        },
        exact: {
          mean: mean((r) => r.pctExact),
          max: pxMeasured.length === 0 ? null : Math.max(...pxMeasured.map((r) => r.pctExact)),
          perfect: pxMeasured.filter((r) => r.pctExact === 0).length,
        },
        aa: {
          mean: mean((r) => r.pctAA),
          max: pxMeasured.length === 0 ? null : Math.max(...pxMeasured.map((r) => r.pctAA)),
          perfect: pxMeasured.filter((r) => r.pctAA === 0).length,
        },
        worst: worst.map((r) => ({ key: r.key, pctExact: r.pctExact, pctAA: r.pctAA, ...(r.unscorable ? { unscorable: r.unscorable } : {}), ...(r.note ? { note: r.note } : {}) })),
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
      '## DOM-anatomy promotion (Round 4 — computed-only elements carried as parts)',
      '',
      `- parts carried: **${promotion.partIndex.size}** (union anatomy incl. structure-creating-prop subtrees) · svg assets reconstructed: **${promotion.assets.size}** · named refusals: **${promotion.refusals.length}**`,
      ...[...promotion.assets.keys()].sort().map((a) => `- asset: \`${a}.svg\` (committed under out/<comp>/assets; promoted to examples/polaris/assets/icons at promotion)`),
      ...promotion.receipts.map((r) => `- ${r}`),
      ...promotion.refusals.map((r) => `- **REFUSED**: ${r}`),
      ...(decisionNotes.length ? ['', '### Human-acked decisions re-applied (gate scores resolved bindings)', '', ...decisionNotes.map((d) => `- ${d}`)] : []),
      '',
      '## Read-boundary frontier (conformance round — every line here used to be silence)',
      '',
      ...frontierReceipts.map((r) => `- ${r}`),
      ...styledReceipts.filter((r) => r.startsWith('webkit-')).map((r) => `- ${r}`),
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
      ...prep.remintReceipts.map((r) => `- ${r}`),
      '',
      '## Declared facts (v15 — carried, first-class)',
      '',
      `- base declared facts: **${prep.declared.length}**`,
      ...prep.declared.map((d) => `  - ${d.part}.${d.channel} = \`${d.value}\``),
      `- state declared facts: **${prep.declaredStates.length}**`,
      ...prep.declaredStates.map((d) => `  - [${d.state}] ${d.part}.${d.channel} = \`${d.value}\``),
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
      `- computed-equality (styled channels, contract-mediated): **${fmt(scorecard.computed.pctEqual)}** (${scorecard.computed.cellsEqual}/${scorecard.computed.cellsCompared} cells; ${scorecard.computed.rowsFullyEqual}/${scorecard.computed.rows} combo×state rows fully equal)`,
      // fix 5 (task #33): the ledger says how many pairs were actually
      // MEASURED and names every exclusion. It used to quote a mean over rows
      // pixelmatch never ran on.
      `- pixel: ${scorecard.pixel.perfectExact}/${scorecard.pixel.pairs} pairs perfect at threshold 0 · ${scorecard.pixel.perfectAA}/${scorecard.pixel.pairs} at the AA point (mean AA ${fmt(scorecard.pixel.meanAA)}, max ${fmt(scorecard.pixel.maxAA)}; ${scorecard.pixel.measured}/${scorecard.pixel.pairs} pairs MEASURED — ${scorecard.pixel.unscored.sizeMismatch} size-mismatched, ${scorecard.pixel.unscored.noOriginal} with no original screenshot, none averaged)`,
      '',
    ];

    // MIRROR of the quarantine path's stale-artifact rule (2026-08-03, walked
    // live): a SUCCESS must delete a stale refusal.json/REFUSAL.md from a
    // previous run, or the component stays "quarantined" forever — onboard
    // --continue gates on existsSync(refusal.json) and re-prints the old
    // reason as if current, with no recovery short of an out-of-band rm. A
    // refusal that no longer describes reality is a false receipt.
    rmSync(path.join(outDir, 'refusal.json'), { force: true });
    rmSync(path.join(outDir, 'REFUSAL.md'), { force: true });
    writeFileSync(path.join(outDir, 'enriched.contract.json'), JSON.stringify(enriched, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'enriched.extension.json'), JSON.stringify(extension, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'review-queue.json'), JSON.stringify(reviewQueue, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'scorecard.json'), JSON.stringify(scorecard, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'numbers.json'), JSON.stringify(numbers, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'pixel-rows.json'), JSON.stringify(pixelRows, null, 2) + '\n');
    writeFileSync(path.join(outDir, 'LEDGER.md'), ledger.join('\n') + '\n');
    rmSync(replayShots, { recursive: true, force: true });

    console.log(`  ✔ bound ${boundConfirmed}/${boundRows.length} · minted ${numbers.minted.leaves} leaves (unfolded ${prep.unfoldedLeafCount}) · folds ${folds.length}`);
    console.log(`  ✔ replay computed equality ${fmt(reread.pct)} · pixel AA perfect ${numbers.pixel.aa.perfect}/${pxComparable.length} measured pairs (${numbers.pixel.unscored.sizeMismatch} size-mismatched, ${numbers.pixel.unscored.noOriginal} no-original — NOT scored)`);
    console.log(`  ✔ gate computed ${fmt(scorecard.computed.pctEqual)} · gate pixel AA perfect ${scorecard.pixel.perfectAA}/${scorecard.pixel.pairs} (${scorecard.pixel.measured} measured)`);

    // Recorded only on the success path: a quarantined component shipped no
    // contract, so there is nothing to confuse with another component's.
    mountRows.push({ name: comp.name, sigChain: aligned.baseFlat.map((e) => e.sig).join(' → '), anatomy: gated.anatomy });
  };

  // ═══ CONFORMANCE FRONTIER (R3) — PER-COMPONENT QUARANTINE ═══
  //
  //  A SINGLE UNREGISTERED CSS CHANNEL USED TO ABORT THE ENTIRE RUN. The
  //  refusal was loud and precisely named — `accent-color`, `grid-auto-rows`,
  //  the SVG geometry attributes `cx/cy/r/x/y` each threw at
  //  `validateContract` and killed the round before ANY artifact was written —
  //  but a real library that ships `accent-color` on ONE component could not
  //  be onboarded AT ALL, and no artifact of the other components survived to
  //  say why. That directly contradicts the point of the project.
  //
  //  The refusal is now SCOPED TO THE COMPONENT. The rest of the library
  //  completes and reports; the quarantined component ships:
  //
  //    · its captured-truth.json — the MEASUREMENT is not the contract's to
  //      refuse, and without it nothing can diagnose the quarantine;
  //    · REFUSAL.md + refusal.json naming the channel and the reason;
  //    · NO CONTRACT, and no partial one.
  //
  //  NO CONTRACT rather than a contract flagged incomplete, deliberately: an
  //  "incomplete" contract is indistinguishable downstream from a complete
  //  one. Every consumer in this repo — emit-react, emit-figma-script, the
  //  bundle CLI, figma push — takes a Contract and compiles it, and a flag
  //  none of them reads is a flag that ships the missing channel silently.
  //  A REFUSAL.md cannot be mistaken for a contract by anything.
  //
  //  SILENCE IS THE ENEMY: the process exit status is NON-ZERO whenever
  //  anything quarantined, the count prints in the run summary, and the
  //  library scorecard carries it (extract/computed/library-scorecard.ts).
  const quarantined: Array<{ component: string; contract: string; reason: string; detail: string[] }> = [];
  for (const { comp, space } of mounts) {
    try {
      await runOne(comp, space);
    } catch (err) {
      const e = err as Error & { quarantine?: { reason: string; detail: string[] } };
      if (!e.quarantine) throw err; // a real engine fault is still a hard stop
      const outDir = path.join(OUT_ROOT, comp.name.toLowerCase());
      mkdirSync(outDir, { recursive: true });
      // The contract artifacts of a quarantined component must NOT exist —
      // a stale one from a previous run would read as this run's output.
      for (const f of ['enriched.contract.json', 'enriched.extension.json', 'resolved.contract.json', 'scorecard.json', 'numbers.json', 'pixel-rows.json', 'gate.html', 'replay.html', 'gate-shots', 'orig-shots', 'assets']) {
        rmSync(path.join(outDir, f), { recursive: true, force: true });
      }
      const record = {
        _marker: 'QUARANTINE — this component produced NO CONTRACT. The refusal below is scoped to this component; the rest of the library completed. NOTHING here is a partial contract: a partial contract is indistinguishable downstream from a complete one, so none is written.',
        component: comp.name,
        contract: comp.contract,
        generatedBy: 'extract/computed/run.ts',
        library: `${cfg.library.package}@${cfg.library.version}`,
        reason: e.quarantine.reason,
        detail: e.quarantine.detail,
        capturedTruthWritten: existsSync(path.join(outDir, 'captured-truth.json')),
      };
      writeFileSync(path.join(outDir, 'refusal.json'), JSON.stringify(record, null, 2) + '\n');
      writeFileSync(
        path.join(outDir, 'REFUSAL.md'),
        [
          `# QUARANTINED — ${comp.name} produced NO CONTRACT`,
          '',
          `${record._marker}`,
          '',
          `- library: \`${record.library}\``,
          `- reason: **${record.reason}**`,
          `- captured-truth.json written: **${record.capturedTruthWritten}** (the measurement survives the refusal)`,
          '',
          '## What was refused',
          '',
          ...e.quarantine.detail.map((d) => `- ${d}`),
          '',
        ].join('\n'),
      );
      quarantined.push({ component: comp.name, contract: comp.contract, reason: e.quarantine.reason, detail: e.quarantine.detail });
      console.log(`  ✖ QUARANTINED ${comp.name} — ${e.quarantine.reason}; NO contract written (REFUSAL.md + refusal.json + captured-truth.json)`);
    }
  }


  rmSync(scratchShots, { recursive: true, force: true });
  await browser.close();

  // ═══ MOUNT SANITY — did every component mount ITSELF? ═══
  // Two different components cannot render the same DOM with the same styles.
  // When they do, one of them mounted the other — the classic shape being a
  // trigger-required component (Popover, Dropdown, Menu) captured with no open
  // state, which renders its ACTIVATOR and reports success. See
  // extract/computed/mount-sanity.ts for the false-positive measurement that
  // chose this fingerprint over three weaker ones.
  const mountFindings = mountSanity(mountRows);
  if (mountFindings.length > 0) {
    console.log(`\n✖ MOUNT SANITY — ${mountFindings.length} collision(s) across ${mountRows.length} captured component(s):`);
    for (const f of mountFindings) console.log(`  ✖ ${f.name}: ${f.message}`);
    console.log('  exit status is NON-ZERO: a contract that describes a different component is worse than no contract');
    process.exitCode = 1;
  } else if (mountRows.length > 1) {
    console.log(`\n  ✔ mount sanity: ${mountRows.length} components, ${mountRows.length} distinct captures — none mounted another`);
  }

  console.log(`\ndone in ${Math.round((Date.now() - t0) / 1000)}s`);
  if (quarantined.length > 0) {
    console.log(
      `\n✖ QUARANTINED ${quarantined.length}/${mounts.length} component(s) — NO contract shipped for: ${quarantined.map((q) => `${q.component} (${q.reason})`).join('; ')}`,
    );
    console.log('  the rest of the library completed; exit status is NON-ZERO because a quarantine is a defect, not a waiver');
    process.exitCode = 1;
  }
}

await main();
