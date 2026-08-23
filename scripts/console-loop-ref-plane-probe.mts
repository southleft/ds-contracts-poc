/** REF-PLANE PROBE — does the pinned reference name a design plane the canvas cell IS?
 *
 *  Successor question to scripts/polaris-ref-triangle.mts. That probe asked
 *  "is the committed reference STALE?" (contract revision drift). This one asks
 *  the question the REFERENCE-TRUTH round exposed underneath it:
 *
 *      the scorer picks ONE canvas VARIANT cell and ONE library render.
 *      Do those two name the SAME point in the component's prop space?
 *
 *  The lane's reference is resolved by `scripts/visual-truth-run.mjs`:
 *      receipt.visual.reference → trap manifest → pickGateShot(dir)
 *  and `pickGateShot` returns `readdirSync(dir).sort()` filtered to
 *  `*__default.png`, FIRST ONE WINS. That sort is ALPHABETICAL, so on any
 *  component whose capture matrix carries an enabled/disabled axis the pinned
 *  reference is the DISABLED render — "disabled" < "enabled" — while the canvas
 *  cell chosen by `chooseCell` can only ever be an enabled variant, because the
 *  emitted set carries `disabled` as a Figma BOOLEAN property (which cannot
 *  repaint a fill) and not as a variant axis. The pair is then cross-plane and
 *  its pctAAMasked measures the plane gap, not canvas fidelity.
 *
 *  This probe scores each stem's COMMITTED canvas cell against EVERY library
 *  render (`orig-shots/`) and every contract render (`gate-shots/`) available
 *  for it, and prints the matrix next to the currently-pinned key. Reading:
 *
 *    pinned key is the argmin              → the pin is plane-consistent; the
 *                                            number is a real fidelity number.
 *    pinned key ≫ some other __default key → CROSS-PLANE PIN. The gap between
 *      differing only in a state token       them is the unmeasured state plane,
 *                                            not a canvas defect.
 *
 *  The matrix is DIAGNOSTIC ONLY. It must never be used to re-pin a reference
 *  by argmin — that is cherry-picking. Re-pinning is done by the contract's own
 *  declared prop DEFAULTS (`--defaults`), which is deterministic and blind to
 *  the score.
 *
 *  Usage:
 *    npx tsx scripts/console-loop-ref-plane-probe.mts --lane mui [--stem checkbox]
 *    npx tsx scripts/console-loop-ref-plane-probe.mts --lane mui --defaults
 *    npx tsx scripts/console-loop-ref-plane-probe.mts --lane mui --repin
 *
 *  Writes: parity/receipts/console-loop/<lane>/ref-plane/PROBE.json (or --out DIR)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { PNG } = await import(ROOT + '/node_modules/pngjs/lib/png.js');
const { scoreStemPair } = await import(ROOT + '/extract/figma/visual-truth/score-policy.mjs');
const scorer: any = await import(pathToFileURL(path.join(ROOT, 'extract/figma/canvas-gate/score.ts')).href);
const { alignPair, scoreCell } = scorer;

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const lane = argValue('--lane') ?? 'mui';
const onlyStem = argValue('--stem');
const wantDefaults = process.argv.includes('--defaults');
const wantRepin = process.argv.includes('--repin');

const CL = path.join(ROOT, 'parity/receipts/console-loop');
const VT = path.join(CL, 'visual-truth', lane);
const LANE_DIR = path.join(CL, lane);
const OUT = argValue('--out') ?? path.join(LANE_DIR, 'ref-plane');
mkdirSync(OUT, { recursive: true });

/** extract/computed/out/<lane>/<comp> — the capture dir is the stem with
 *  separators stripped, except where the capture config named the component
 *  differently from the console-loop stem (recorded, never guessed). */
const CAPTURE_ROOT = path.join(ROOT, 'extract/computed/out', lane);
const DIR_ALIAS: Record<string, string> = { 'table-pagination': 'pagination' };
function captureDir(stem: string): string | null {
  const cand = DIR_ALIAS[stem] ?? stem.replace(/-/g, '');
  const p = path.join(CAPTURE_ROOT, cand);
  return existsSync(p) ? p : null;
}

const CONTRACTS = path.join(ROOT, 'examples', lane, 'contracts');

/** The contract's declared default point in prop space, as capture-key tokens.
 *  MUI's capture configs spell a boolean `disabled` axis as enabled|disabled,
 *  so a `false` default reads as the token `enabled`. */
function defaultTokens(stem: string): string[] | null {
  const p = path.join(CONTRACTS, `${stem}.contract.json`);
  if (!existsSync(p)) return null;
  const c = JSON.parse(readFileSync(p, 'utf8'));
  const toks: string[] = [];
  for (const prop of c.props ?? []) {
    const d = prop.default;
    if (d === undefined || d === null) continue;
    if (typeof d === 'boolean') toks.push(d ? prop.name : `not-${prop.name}`);
    else toks.push(String(d));
  }
  return toks;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** ── THE STATE PLANE ────────────────────────────────────────────────────────
 *  `extract/computed/configs/<lane>.json` declares `stateProps: [{prop,state}]`
 *  for components whose capture matrix sweeps a REACT PROP as a state plane
 *  (MUI: `disabled`). The capture key spells that plane as the LAST segment of
 *  the variant part — `checked.disabled__default`, `checked.enabled__default` —
 *  where `enabled` is the BASE (prop absent) rendering.
 *
 *  The canvas can only express that plane when the contract binds the prop as a
 *  Figma VARIANT axis, or when `bindings.figma.statePreviews` is on and the emitter
 *  compiles a `State=` axis (core/emit-figma-script.ts). Bound as a Figma
 *  BOOLEAN — which toggles child visibility and CANNOT repaint a fill — the
 *  non-base value has no cell anywhere in the set, so a reference pinned there
 *  is CROSS-PLANE and its pctAAMasked measures the missing plane, not fidelity.
 */
const CONFIG_PATH = path.join(ROOT, 'extract/computed/configs', `${lane}.json`);
const STATE_BASE = 'enabled';
type StatePlane = { prop: string; state: string; canvasExpressible: boolean; how: string };
const statePlanes = new Map<string, StatePlane>();
if (existsSync(CONFIG_PATH)) {
  const cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const STEM_ALIAS: Record<string, string> = { pagination: 'table-pagination' };
  for (const c of cfg.components ?? cfg ?? []) {
    const sp = (c.stateProps ?? [])[0];
    if (!sp) continue;
    const base = path.basename(String(c.contract ?? '')).replace('.contract.json', '');
    const stem = STEM_ALIAS[base] ?? base;
    const cPath = path.join(CONTRACTS, `${stem}.contract.json`);
    if (!existsSync(cPath)) continue;
    const contract = JSON.parse(readFileSync(cPath, 'utf8'));
    const prop = (contract.props ?? []).find((p: any) => p.name === sp.prop);
    const kind = prop?.bindings?.figma?.kind ?? null;
    const previews = Boolean(contract.bindings?.figma?.statePreviews) && (contract.states ?? []).includes(sp.state);
    statePlanes.set(stem, {
      prop: sp.prop,
      state: sp.state,
      canvasExpressible: kind === 'VARIANT' || previews,
      how: kind === 'VARIANT' ? 'variant-axis' : previews ? 'figmaStatePreviews' : `figma binding ${kind ?? 'none'}`,
    });
  }
}

/** key "checked.disabled__default" → { variant: [checked, disabled], state: default } */
function parseKey(file: string) {
  const n = file.replace(/\.png$/, '').replace(/^pair--/, '');
  const [variantPart, statePart] = n.split('__');
  return {
    key: n,
    variant: (variantPart ?? '').split('.').map(norm).filter(Boolean),
    state: norm(statePart ?? ''),
  };
}

function readPng(p: string) {
  return PNG.sync.read(readFileSync(p));
}

const receiptsDir = path.join(LANE_DIR, 'components');
const stems = readdirSync(receiptsDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .filter((s) => !onlyStem || s === onlyStem)
  .sort();

const results: any[] = [];
for (const stem of stems) {
  const cardPath = path.join(VT, `${stem}.json`);
  const shotPath = path.join(VT, 'shots', `${stem}.png`);
  if (!existsSync(cardPath) || !existsSync(shotPath)) {
    results.push({ stem, error: 'no committed canvas card/shot' });
    continue;
  }
  const card = JSON.parse(readFileSync(cardPath, 'utf8'));
  const dir = captureDir(stem);
  if (!dir) {
    results.push({ stem, error: 'no capture dir' });
    continue;
  }
  const pinnedRel: string = card.reference ?? '';
  const pinnedKey = parseKey(path.basename(pinnedRel));
  /** The canvas cell's own point in prop space, from its variant name. */
  const cellTokens = String(card.cellName ?? '')
    .split(',')
    .map((s) => {
      const eq = s.split('=');
      return norm(eq[1] ?? eq[0]);
    })
    .filter(Boolean);

  const canvas = readPng(shotPath);
  const rows: any[] = [];
  for (const kind of ['orig-shots', 'gate-shots']) {
    const d = path.join(dir, kind);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith('.png')).sort()) {
      if (!f.endsWith('__default.png')) continue; // the lane only ever pins __default
      let r: any;
      try {
        r = scoreStemPair(canvas, readPng(path.join(d, f)), { alignPair, scoreCell });
      } catch (e: any) {
        rows.push({ kind, key: parseKey(f).key, error: e.message });
        continue;
      }
      rows.push({
        kind,
        key: parseKey(f).key,
        pctAAMasked: r.aaMasked,
        compositionOk: r.compositionOk,
        pass: r.pass,
        canvasPx: `${r.cell.canvasPx ?? ''}`,
        realPx: `${r.cell.realPx ?? ''}`,
      });
    }
  }
  const origRows = rows.filter((r) => r.kind === 'orig-shots' && r.pctAAMasked != null);
  const best = origRows.slice().sort((a, b) => a.pctAAMasked - b.pctAAMasked)[0] ?? null;
  const pinnedRow = origRows.find((r) => r.key === pinnedKey.key) ?? null;

  /** CROSS-PLANE: the pinned key names the NON-BASE value of a state plane the
   *  canvas cannot express. Decided from the capture config + the contract's
   *  own Figma binding — never from a score. */
  const plane = statePlanes.get(stem) ?? null;
  const planeToken = plane ? pinnedKey.variant[pinnedKey.variant.length - 1] : null;
  const crossPlane = Boolean(
    plane && !plane.canvasExpressible && planeToken === norm(plane.state),
  );
  /** The plane-consistent sibling: the same point in prop space on the BASE
   *  plane. Exactly one candidate exists, so this is deterministic. */
  const repinKey = crossPlane
    ? `${pinnedKey.variant.slice(0, -1).join('.')}${pinnedKey.variant.length > 1 ? '.' : ''}${STATE_BASE}__${pinnedKey.state}`
    : null;
  const unmatched = crossPlane ? [planeToken as string] : [];

  const defTok = defaultTokens(stem);
  let defaultsKey: string | null = null;
  if (defTok) {
    // score-free: the orig-shot whose variant tokens are exactly the contract defaults
    const want = defTok.map(norm).filter((t) => !t.startsWith('not'));
    const cand = origRows.find((r) => {
      const v = parseKey(`${r.key}.png`).variant.filter((t) => t !== 'enabled');
      return v.length === want.length && want.every((w) => v.includes(w));
    });
    defaultsKey = cand?.key ?? null;
  }

  results.push({
    stem,
    cellName: card.cellName,
    cellTokens,
    pinned: pinnedKey.key,
    pinnedPct: pinnedRow?.pctAAMasked ?? card.metrics?.pctAAMasked ?? null,
    statePlane: plane,
    crossPlane,
    repinKey,
    repinPct: repinKey ? (origRows.find((r) => r.key === repinKey)?.pctAAMasked ?? null) : null,
    crossPlaneTokens: unmatched,
    bestOrig: best ? { key: best.key, pctAAMasked: best.pctAAMasked, pass: best.pass } : null,
    contractDefaults: defTok,
    defaultsKey,
    defaultsPct: defaultsKey ? (origRows.find((r) => r.key === defaultsKey)?.pctAAMasked ?? null) : null,
    rows,
  });
}

/** The full matrix is the diagnostic; the committed artifact keeps every row for
 *  a stem the probe FLAGGED and only the rows the summary cites for the rest.
 *  `--full` keeps everything (the whole mui matrix is ~228 KB). */
const wantFull = process.argv.includes('--full');
const committed = results.map((r) => {
  // Every stem carrying a state plane the canvas CANNOT express keeps its whole
  // matrix — that is the standing evidence that the base-plane pin is the
  // plane-consistent one, and it must survive the re-pin that makes
  // `crossPlane` false again. A plane the canvas CAN express (button, via
  // bindings.figma.statePreviews) is not at risk, so it elides like any other stem.
  if (r.error || wantFull || r.crossPlane || (r.statePlane && !r.statePlane.canvasExpressible)) return r;
  const cited = new Set([r.pinned, r.repinKey, r.bestOrig?.key, r.defaultsKey].filter(Boolean));
  return { ...r, rows: r.rows.filter((x: any) => cited.has(x.key)), rowsElided: r.rows.length - cited.size };
});
writeFileSync(
  path.join(OUT, 'PROBE.json'),
  `${JSON.stringify({ recordedAt: new Date().toISOString(), lane, full: wantFull, results: committed }, null, 2)}\n`,
);

const n = (v: any) => (v == null ? '  —  ' : Number(v).toFixed(2).padStart(6));
for (const r of results) {
  if (r.error) {
    console.log(`${r.stem.padEnd(18)} ERROR ${r.error}`);
    continue;
  }
  const flag = r.crossPlaneTokens.length ? ` CROSS-PLANE[${r.crossPlaneTokens.join(',')}]` : '';
  console.log(
    `${r.stem.padEnd(18)} cell=${String(r.cellName).padEnd(38)} pinned ${String(r.pinned).padEnd(34)} ${n(r.pinnedPct)}` +
      `  best ${String(r.bestOrig?.key ?? '—').padEnd(34)} ${n(r.bestOrig?.pctAAMasked)}` +
      `  defaults ${String(r.defaultsKey ?? '—').padEnd(30)} ${n(r.defaultsPct)}${flag}`,
  );
}
if (wantDefaults) {
  console.log('\nContract-default re-pin candidates (deterministic, score-blind):');
  for (const r of results) {
    if (r.error || !r.defaultsKey || r.defaultsKey === r.pinned) continue;
    console.log(`  ${r.stem.padEnd(18)} ${r.pinned}  →  ${r.defaultsKey}`);
  }
}

/** --repin: move a CROSS-PLANE reference onto the base plane the canvas cell
 *  actually is. The target is computed from the capture config + the contract's
 *  Figma binding (above) and is unique, so this can never select-for-score. The
 *  DROPPED plane is not thereby excused — it is recorded on the receipt as an
 *  unmeasured region, and the receipt's pass claim is NOT touched here: only
 *  the scorer may move visual.ok / matchDeveloped. Re-run
 *  `console-loop-developed-score.mjs --lib <lane> --stem <s>` and
 *  `visual-truth-run.mjs --lib <lane> --stem <s>` afterwards. */
if (wantRepin) {
  console.log('\n--repin (cross-plane references → base plane):');
  for (const r of results) {
    if (r.error || !r.crossPlane || !r.repinKey) continue;
    const dir = captureDir(r.stem)!;
    const target = path.join(dir, 'orig-shots', `${r.repinKey}.png`);
    if (!existsSync(target)) {
      console.log(`  ${r.stem.padEnd(18)} REFUSED — base-plane render absent: ${path.relative(ROOT, target)}`);
      continue;
    }
    const rel = path.relative(ROOT, target);
    const receiptPath = path.join(LANE_DIR, 'components', `${r.stem}.json`);
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    const prior = receipt.visual?.reference ?? null;
    receipt.visual = receipt.visual ?? {};
    receipt.visual.reference = rel;
    receipt.visual.referenceSource =
      `${rel} — REAL LIBRARY RENDER, BASE STATE PLANE. Re-pinned by ` +
      `scripts/console-loop-ref-plane-probe.mts --repin: the prior pin (${prior}) named the ` +
      `\`${r.statePlane.state}\` value of the \`${r.statePlane.prop}\` state plane, which this canvas set ` +
      `cannot express (${r.statePlane.how}) — no cell anywhere in the set is ${r.statePlane.state}, so the ` +
      `scorer's chosen cell "${r.cellName}" and that reference named different points in prop space. ` +
      `The \`${r.statePlane.state}\` plane is now UNMEASURED and named as such (FC-STATE-PLANE-ABSENT).`;
    receipt.visual.crossPlaneRepin = {
      at: new Date().toISOString(),
      priorReference: prior,
      priorPctAAMasked: r.pinnedPct,
      statePlane: r.statePlane,
      cellName: r.cellName,
      rule: 'reference must lie in the intersection of the canvas set\'s expressible prop space and the capture matrix',
    };
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    console.log(`  ${r.stem.padEnd(18)} ${r.pinned}  →  ${r.repinKey}   (${n(r.pinnedPct)} → ${n(r.repinPct)} pctAAMasked)`);
  }
}
