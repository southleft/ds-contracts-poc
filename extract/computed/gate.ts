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
import { statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Page } from 'playwright-core';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { emitHtml } from '../../core/emit-html.js';
import { generateCss } from '../../core/emit-react.js';
import { walkAnatomy } from '../../scripts/contract-schema.js';
import { mintedTokenCss } from '../../core/mint-tokens.js';
import { flattenTokens, makeResolveLiteral, tokenInventoryFromJson, type TokenEntry } from '../../core/tokens.js';
import { kebab } from '../types.js';
import type { Contract } from '../../scripts/contract-schema.js';
import type { CaptureConfig, ComponentConfig, PropSpace, Interaction } from './capture.js';
import { INTERACTIONS, settleStage, stageFor } from './capture.js';
import { isFusable, kindOf, mergeShippedMinted, SYNTHETIC_CHANNELS, type Capture, type Combo, type FlatEl, type MintedMerge } from './lib.js';
import type { AlignedSweep } from './fuse.js';

export interface GateRow {
  key: string; // `${combo}__${interaction}`
  channelsCompared: number;
  channelsEqual: number;
  /** SILENT-LOSS ROUND (task #33, fix 5): NULL means NOT MEASURED. It used to
   *  be the number 100, asserted rather than measured, and indistinguishable
   *  from a genuinely-measured 100%-differing row. See `unscorable`. */
  pctExact: number | null;
  pctAA: number | null;
  /** Why this row carries no pixel score. `size-mismatch` = our render is a
   *  different SIZE than the original, so pixelmatch cannot run at all (a
   *  total geometry failure, and one that must never be averaged as if it
   *  were a measurement); `no-original` = the original screenshot does not
   *  exist (portal roots the sweep could not shoot). Both are COUNTED and
   *  PRINTED — an exclusion nobody counts is a silent drop. */
  unscorable?: 'size-mismatch' | 'no-original';
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
    /** fix 5: rows pixelmatch actually ran on — the mean's denominator. */
    measured: number;
    /** fix 5: the COUNTED exclusions (an uncounted exclusion is a silent drop). */
    unscored: { sizeMismatch: number; noOriginal: number; note: string };
    /** fix 5: NULL when nothing was measured. It must NOT be 0 — in this
     *  metric 0 means PERFECT, so an empty mean rendered as 0 would read as
     *  the best possible score for a component nothing could be scored on
     *  (MUI's Dialog: 5 size-mismatched pairs, 0 measured). */
    meanExact: number | null;
    meanAA: number | null;
    maxAA: number | null;
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
  worstRows: Array<{ key: string; pctAA: number | null; pctExact: number | null; channelsMismatched: number; unscorable?: 'size-mismatch' | 'no-original' }>;
  topMismatchedChannels: Array<[string, number]>;
  namedLosses: string[];
  /** DEFECT FIXED (regate-drift triage): the gate page resolves a contract's
   *  token refs through custom properties, and emit-html maps ANY `{a.b.c}`
   *  to `var(--a-b-c)` without consulting the inventory — a ref the inventory
   *  does not carry renders as an EMPTY custom property (black text, missing
   *  fills) and the % simply falls, with no receipt naming why. Field case:
   *  offline re-fuse of the astryx Slider re-minted 111 leaves that no longer
   *  include the 14 (`imported.shared.color-0064e0`, `imported.slider.label
   *  .color`, …) the FROZEN promoted contract still references — a 32-point
   *  collapse that read as "engine regression". The census runs the emitters'
   *  OWN referee (core/emit-react generateCss) over the same inventory the
   *  page renders with, so an unresolvable ref is a NAMED number, never a
   *  silent one. Zero here means every ref the page emits has a value.
   *
   *  The CAUSE that census exposed was fixed later, in task #21: the
   *  inventory itself was wrong (see `shippedMinted` below). Every one of the
   *  36 committed components now measures zero — so a non-zero count is a
   *  genuinely dangling ref, not an artifact of what the gate can see. */
  unresolvedTokenRefs: { count: number; refs: string[] };
  /** GATE-INVENTORY FIX (task #21). The gate measures the fidelity of the
   *  SHIPPED truth, so its inventory must be the token set the shipped
   *  contract can actually see: `cfg.tokens.dtcg` + this run's FRESH mint +
   *  the library's SHIPPED minted tree (`cfg.tokens.minted`), fresh winning
   *  every collision. Before the fix the shipped tree was in neither the
   *  inventory nor the rendered custom properties, so every reviewed-layer
   *  ref the current mint no longer produces rendered EMPTY and the score
   *  fell silently (astryx Slider 55.299 with 44 such refs — all 44 present
   *  in the shipped tree). `leavesAdded` is how many leaves the shipped tree
   *  contributed; `divergent` names every leaf BOTH trees carry with
   *  different values — fresh wins, but a divergence is a candidate real
   *  regression and is never chosen in silence. */
  shippedMinted: {
    path: string;
    leavesAdded: number;
    /** ORDERING GUARD (task #28, `CaptureConfig.tokens.mintedBootstrap`).
     *  Present ONLY on a library's genuine first-ever pass, when no promotion
     *  has written the minted tree yet; `note` carries the receipt sentence.
     *  Every other run is refused at config load rather than recording a
     *  `leavesAdded: 0` that looks like a measurement. */
    bootstrap?: true;
    note?: string;
    /** `resolvedEqual` separates a RE-ANCHORING (the shipped tree aliases an
     *  equal-valued semantic token — same paint, different spelling) from a
     *  real value disagreement, which is the regression candidate. */
    divergent: Array<{ token: string; fresh: string; shipped: string; resolvedEqual: boolean }>;
  };
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

/**
 * THE GATE'S TOKEN INVENTORY (task #21) — `cfg.tokens.dtcg` + this run's
 * FRESH mint + the library's SHIPPED minted tree, fresh winning every
 * collision. See `Scorecard.shippedMinted` for why the shipped tree belongs
 * in it and `mergeShippedMinted` for why fresh wins.
 *
 * Exported because the harness (`run.ts`) and the offline runner
 * (`regate.ts`) referee HUMAN-ACKED DECISIONS against "the SAME inventory the
 * gate renders with" before handing the contract to the gate. That sentence
 * was in both files as a comment and was true only by coincidence; it is now
 * true by construction — one function, three callers.
 */
export function gateInventory(
  repoRoot: string,
  cfg: CaptureConfig,
  mintedTree: Record<string, unknown>,
): { inventory: Set<string>; merged: MintedMerge; baseTrees: Array<Record<string, unknown>> } {
  const shipped = cfg.tokens.minted
    ? (JSON.parse(readFileSync(path.join(repoRoot, cfg.tokens.minted), 'utf8')) as Record<string, unknown>)
    : {};
  const merged = mergeShippedMinted(mintedTree, shipped);
  const baseTrees = cfg.tokens.dtcg.map((p) => JSON.parse(readFileSync(path.join(repoRoot, p), 'utf8')) as Record<string, unknown>);
  return { inventory: tokenInventoryFromJson([...baseTrees, merged.tree]), merged, baseTrees };
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
  // NAMED refusal, not a bare EISDIR: an empty tokens.css joins to the
  // repo-root DIRECTORY and used to die mid-run after ~30s of real browser
  // time with an error blaming readFileSync. Refuse before spending anything.
  if (!cfg.tokens.css || cfg.tokens.css.trim() === '') {
    throw new Error(
      'gate REFUSED: capture config tokens.css is empty — the gate page renders against the library token stylesheet, so name the built CSS file (see any committed config under extract/computed/configs/) or run without the gate.',
    );
  }
  const tokensCssPath = path.join(repoRoot, cfg.tokens.css);
  if (!existsSync(tokensCssPath) || !statSync(tokensCssPath).isFile()) {
    throw new Error(
      `gate REFUSED: tokens.css "${cfg.tokens.css}" is not a readable file (resolved ${tokensCssPath}) — the gate page renders against the library token stylesheet; fix the path in the capture config.`,
    );
  }
  const tokensCss = readFileSync(tokensCssPath, 'utf8');
  const { inventory, merged, baseTrees } = gateInventory(repoRoot, cfg, mintedTree);

  // A divergence between the fresh and shipped spellings of the same leaf is
  // only a REGRESSION CANDIDATE if the two RESOLVE differently: the
  // re-anchoring/alias passes replaced literals with aliases to equal-valued
  // semantic tokens ('#4e606f' → '{color-text-secondary}' = '#4E606F'), and
  // reporting that as a value disagreement would cry wolf. Both classes are
  // recorded; only the unequal ones are a finding.
  //
  // COLOUR NOTATION IS NOT COLOUR. The mint writes 8-digit hex, the libraries
  // write '#fff' and 'rgba(0, 0, 0, 0.6)' — string comparison called 34 of
  // those pairs "different" on the first cut when every one of them paints the
  // identical pixel. Colours are canonicalized through the SAME kindOf the
  // mint itself uses (rgba/oklch → hex, shorthand expanded, alpha explicit);
  // anything that is not a colour compares as a trimmed lowercase string.
  const all = new Map<string, TokenEntry>();
  for (const t of [...baseTrees, merged.tree]) for (const [p, e] of flattenTokens(t)) all.set(p, e);
  const resolve = makeResolveLiteral(all);
  const canonColor = (s: string): string | null => {
    const hex = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (hex) {
      let h = hex[1].toLowerCase();
      if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
      if (h.length === 6) h += 'ff';
      return h.length === 8 ? h : null;
    }
    const k = kindOf('color', s);
    if (!k || k.kind !== 'color') return null;
    const h = String(k.value).toLowerCase();
    return h.length === 6 ? `${h}ff` : h;
  };
  const literal = (v: string): string => {
    const ref = /^\{([^}]+)\}$/.exec(v);
    let raw: string;
    try {
      raw = String(ref ? resolve(ref[1]) : v).trim();
    } catch {
      return `UNRESOLVABLE(${v})`;
    }
    return canonColor(raw) ?? raw.toLowerCase();
  };
  const divergent = merged.divergent.map((d) => ({ ...d, resolvedEqual: literal(d.fresh) === literal(d.shipped) }));
  const realDivergences = divergent.filter((d) => !d.resolvedEqual);
  if (realDivergences.length > 0) {
    console.log(
      `    ⚠ ${comp.name}: ${realDivergences.length} minted leaf/leaves RESOLVE DIFFERENTLY between this run's FRESH mint and the SHIPPED tree — fresh wins (the run's own measurement) and each is named in the scorecard; a real library change looks exactly like this. First: ${realDivergences[0].token} fresh=${realDivergences[0].fresh} shipped=${realDivergences[0].shipped}`,
    );
  }

  // UNRESOLVED-REF CENSUS — see Scorecard.unresolvedTokenRefs. generateCss is
  // the emitters' existing referee for "{path} does not exist in tokens/"; it
  // collects into `errors` rather than throwing, so the census borrows the
  // rule without inventing one and without gating the render (the number is
  // the receipt; a re-fuse against a frozen contract is allowed to be
  // measured, just never silently).
  const refErrors: string[] = [];
  generateCss(enriched, inventory, refErrors);
  const unresolvedRefs = [...new Set(refErrors.filter((e) => e.includes('does not exist in tokens/')))].sort();
  if (unresolvedRefs.length > 0) {
    console.log(
      `    ⚠ ${comp.name}: ${unresolvedRefs.length} token ref(s) in the gated contract are NOT in the gate inventory — they render as EMPTY custom properties and depress the computed %. First: ${unresolvedRefs[0]}`,
    );
  }

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
${mintedTokenCss(merged.tree)}
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
      // TASK #34 — THE GATE NOW SETTLES, LIKE THE CAPTURE ALWAYS HAS.
      // This was `await page.waitForTimeout(30)`: a FIXED 30ms sleep after
      // driving hover/focus/active, with transitions deliberately left
      // enabled. Carbon's transitions are 70-110ms, so the gate sampled
      // MID-FLIGHT and its computed-equality % moved run to run — the
      // non-determinism task #34 records, and the reason carbon/Button alone
      // carried a 0.20 drift tolerance while every other row was pinned at
      // 0.001. The capture sweep has polled to a two-consecutive-stable-sample
      // steady state since the MUI round; there was never a principled reason
      // for the two sampling points to differ, and now they share ONE
      // implementation (capture.ts `settleStage`).
      await settleStage(page, stageSel);

      const key = `${combo.key}__${interaction}`;
      const truthCap = aligned.byKey.get(key);
      const row: GateRow = { key, channelsCompared: 0, channelsEqual: 0, pctExact: null, pctAA: null, unscorable: 'no-original', mismatches: [] };
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
        const channels = [...(styled.get(part) ?? [])].filter((c) => isFusable(c) && !SYNTHETIC_CHANNELS.has(c)).sort();
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
          // fix 5: this used to write the NUMBER 100 into pctExact/pctAA and
          // let it into the mean. pixelmatch never ran — there is no
          // measurement here, only the knowledge that the geometry is wrong.
          // A fabricated number that happens to point the right way is still
          // fabricated, and it was indistinguishable from a real 100. The row
          // is now explicitly UNSCORABLE: excluded from the mean, counted in
          // `pairs`, and structurally unable to be `perfect`.
          row.pctExact = null;
          row.pctAA = null;
          row.unscorable = 'size-mismatch';
          row.note = [row.note, `size mismatch ours ${b.width}x${b.height} vs orig ${a.width}x${a.height} — NOT SCORED (a wrong-sized box is a geometry failure, not a percentage)`].filter(Boolean).join('; ');
        } else {
          const total = a.width * a.height;
          const diffExact = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0, includeAA: true });
          const diffAA = pixelmatch(a.data, b.data, undefined, a.width, a.height, { threshold: 0.1 });
          row.pctExact = (100 * diffExact) / total;
          row.pctAA = (100 * diffAA) / total;
          delete row.unscorable;
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
  // fix 5: the denominators, said out loud.
  //   · `comparable` — a row with an original screenshot to compare against.
  //     A `no-original` row was never a pair at all and is excluded from
  //     `pairs` (this is what `!r.note?.startsWith('original screenshot')`
  //     used to mean, spelled structurally instead of by prose matching).
  //   · `measured`   — a comparable row that pixelmatch actually ran on.
  //     A size mismatch is comparable (it counts as a failed pair) but NOT
  //     measured, so it can never be `perfect` and never enters a mean.
  const comparable = rows.filter((r) => r.unscorable !== 'no-original');
  const measured = comparable.filter((r) => r.pctExact !== null && r.pctAA !== null) as Array<GateRow & { pctExact: number; pctAA: number }>;
  const sizeMismatched = comparable.filter((r) => r.unscorable === 'size-mismatch');
  const noOriginal = rows.filter((r) => r.unscorable === 'no-original');
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
      pairs: comparable.length,
      perfectExact: measured.filter((r) => r.pctExact === 0).length,
      perfectAA: measured.filter((r) => r.pctAA === 0).length,
      // fix 5: means are over MEASURED rows only, and the exclusion is
      // published next to them — an excluded row nobody counts is exactly
      // the silence this round exists to remove.
      measured: measured.length,
      unscored: {
        sizeMismatch: sizeMismatched.length,
        noOriginal: noOriginal.length,
        note: 'sizeMismatch: our render is a different SIZE than the original, so pixelmatch cannot run — counted in `pairs` (it is a failed pair) and never `perfect`, but NOT averaged: there is no measurement to average. noOriginal: no original screenshot exists, so there was never a pair — excluded from `pairs` entirely.',
      },
      meanExact: measured.length === 0 ? null : measured.reduce((n, r) => n + r.pctExact, 0) / measured.length,
      meanAA: measured.length === 0 ? null : measured.reduce((n, r) => n + r.pctAA, 0) / measured.length,
      maxAA: measured.length === 0 ? null : Math.max(...measured.map((r) => r.pctAA)),
    },
    fusion: opts.fusionCounts,
    worstRows: [...rows]
      // fix 5: an UNSCORED row sorts to the top — it is the worst kind of
      // row (nothing could be measured), not a missing number to skip past.
      .sort((x, y) => (y.pctAA ?? 101) - (x.pctAA ?? 101) || (y.pctExact ?? 101) - (x.pctExact ?? 101) || y.mismatches.length - x.mismatches.length)
      .slice(0, 8)
      .map((r) => ({ key: r.key, pctAA: r.pctAA, pctExact: r.pctExact, channelsMismatched: r.mismatches.length, ...(r.unscorable ? { unscorable: r.unscorable } : {}) })),
    topMismatchedChannels: [...mismatchByChannel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15),
    namedLosses: opts.namedLosses,
    unresolvedTokenRefs: { count: unresolvedRefs.length, refs: unresolvedRefs.slice(0, 40) },
    shippedMinted: {
      path: cfg.tokens.minted ?? '(none declared)',
      leavesAdded: merged.added.length,
      // ORDERING GUARD (task #28): the only run that may legitimately measure
      // against an empty shipped tree says so on the receipt.
      ...(cfg.tokens.mintedBootstrap === true
        ? {
            bootstrap: true as const,
            note: 'measured without a shipped minted tree — this library has never promoted one (tokens.mintedBootstrap). The gate inventory is base + this run\'s FRESH mint only; re-run the harness after the first promotion to measure against the shipped tree.',
          }
        : {}),
      divergent,
    },
    rows,
  };
  return scorecard;
}
