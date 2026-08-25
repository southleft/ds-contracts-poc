/**
 * FUSION GEOMETRY CENSUS — offline, no browser, no capture.
 *
 *   npm run extract:computed:geometry:census            measure + compare
 *   npm run extract:computed:geometry:census -- --write re-record (explicit)
 *
 * WHY THIS EXISTS — THE HOLE IT CLOSES, quoted from the adversarial review
 * that killed the previous attempt at the text-fill geometry door:
 *
 *   "THE PATCH RE-DERIVES 3 COMPONENTS BUT THE ENGINE CHANGE MOVES 18. …
 *    Their committed enriched.extension.json / LEDGER.md are now stale, and
 *    NOTHING in the repo can see it: figma:fresh and generated:fresh re-emit
 *    from committed CONTRACTS, and conformance/run.ts reads committed
 *    artifacts. Both were green for me while carbon/modal, mui/accordion and
 *    mui/select sit three doors stale — the exact hole those two gates were
 *    written to close, reopened on the fusion surface."
 *
 * That is precisely right, and it is a structural gap rather than one
 * patch's mistake. Every freshness gate in this repo starts DOWNSTREAM of
 * fusion: `figma:fresh` re-emits scripts from the committed contracts and
 * byte-compares, `generated:fresh` does the same for the generated surfaces,
 * `conformance` reads the artifacts the capture wrote. None of them re-runs
 * FUSION, so an engine edit that changes what fusion carries — or what it
 * says it dropped — leaves 200-odd committed `enriched.*` artifacts stale
 * with every lane green.
 *
 * WHAT THIS PINS. For every component with a committed
 * `captured-truth.json`, it re-runs the REAL `styledChannels` offline (the
 * capture IS the truth; re-fusing it is deterministic and needs no Chromium)
 * and records two things:
 *
 *   1. `carried` — the GEOMETRY channels that reach fusion, per part. A door
 *      that opens or closes moves this, and a moved row means the component's
 *      committed contract (and everything emitted from it) is stale.
 *   2. `receipts` — a sha256 of the component's geometry RECEIPT lines, in
 *      sorted order. A receipt is the drop ledger: if its wording changes,
 *      the committed `enriched.extension.json` and `LEDGER.md` no longer say
 *      what the engine says, which is the same staleness one level down.
 *
 * The census is NOT a quality bar and makes no claim about whether a door is
 * right. It is a visibility instrument: it turns "the engine moved 18
 * components and nobody could tell" into a red gate that names all 18.
 *
 * REMEDY when it goes red, per named component:
 *   npm run extract:computed -- --config extract/computed/configs/<lib>.json --component <Name>
 * (a real capture wave with Chromium and the library sandbox), then the
 * library's floor-promote script, then re-emit its figma scripts +
 * GENESIS-BATCH; then re-record this census with `-- --write`. Recording the
 * census WITHOUT re-deriving the named components is legal and sometimes
 * right (a receipt reworded on a component nobody ships), but it is then an
 * explicit, reviewable act in the diff instead of an invisible one.
 *
 * FALSIFICATION: change any geometry door in extract/computed/fuse.ts and
 * this gate goes red naming exactly the components it moved.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadConfig, propSpaceFor, stageFor, type CaptureConfig, type ComponentConfig, type SweepResult } from './capture.js';
import { alignSweep, styledChannels, type FusionEnv } from './fuse.js';
import { reconstructCaptures, type CapturedTruthFile } from './replay.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const REPO = path.resolve(HERE, '..', '..');
const CENSUS = path.join(HERE, 'fusion-geometry-census.json');

/** The channels whose carriage is a statement about a BOX. Kept explicit (not
 *  imported from GEOMETRY_CHANNELS) because the insets were never in that set
 *  — task #20's finding — and the census has to see them. */
const GEOMETRY = ['block-size', 'bottom', 'height', 'inline-size', 'left', 'right', 'top', 'width'];

/** The receipt families that are a geometry DOOR speaking. Anything a door
 *  says about a box belongs in the hash; anything else (colour, layout,
 *  tokens) does not, so an unrelated engine change cannot make this gate red. */
const GEOMETRY_RECEIPT = /^(absolute-geometry-(admitted|excluded)|text-fill-pinned-geometry-(admitted|refused)|viewport-(derived-geometry-refused|anchored-translate-carried)|block-root-width-(admitted|refused|source)|stage-fill-root-admitted|token-named-geometry-admitted|table-(geometry-excluded|column-geometry-admitted|cell-geometry-refused)|geometry-excluded):/;

interface Row {
  /** part name → the geometry channels it carries into fusion, sorted. */
  carried: Record<string, string[]>;
  /** sha256 of the sorted geometry receipt lines, joined by \n. */
  receipts: string;
  /** how many receipt lines that hash covers (a human-readable sanity number). */
  receiptCount: number;
}

function measureOne(cfg: CaptureConfig, comp: ComponentConfig, outRoot: string): Row | null {
  const truthPath = path.join(outRoot, comp.name.toLowerCase(), 'captured-truth.json');
  if (!existsSync(truthPath)) return null;
  const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as CapturedTruthFile;
  const captures = reconstructCaptures(truth).map((c) => ({ ...c, combo: `${comp.name}:${c.combo}` }));
  const space = propSpaceFor(REPO, cfg, comp);
  const sweep = {
    captures,
    controls: truth.controls,
    allProps: truth._provenance.channels,
    // Same rule as regate's offline path: an offline re-fuse has no browser to
    // ask which stylesheets were unreadable. EMPTY, never faked.
    stylesheetSkips: [],
    browserVersion: String(truth._provenance.browser ?? 'committed'),
    fontChecks: {},
    pinnedAnimations: [],
    shadowHostTrails: {},
    textFillFolds: {},
    closedShadowSuspects: {},
  } as unknown as SweepResult;
  const aligned = alignSweep(sweep, comp, space, cfg.library.classPrefix);
  const controlStyles = Object.fromEntries(
    Object.entries(truth.controls as Record<string, { style: Record<string, string> }>).map(([t, n]) => [t, n.style]),
  );
  const receipts: string[] = [];
  const env: FusionEnv = {
    viewport: cfg.browser.viewport,
    stage: stageFor(cfg, comp),
    portaled: comp.portalCapture === true,
  };
  const styled = styledChannels(aligned, space, controlStyles, truth._provenance.channels, receipts, env);
  const carried: Record<string, string[]> = {};
  for (const [part, chans] of [...styled].sort((x, y) => x[0].localeCompare(y[0]))) {
    const g = [...chans].filter((c) => GEOMETRY.includes(c)).sort();
    if (g.length > 0) carried[part] = g;
  }
  const geomReceipts = receipts.filter((r) => GEOMETRY_RECEIPT.test(r)).sort();
  return {
    carried,
    receipts: createHash('sha256').update(geomReceipts.join('\n')).digest('hex').slice(0, 16),
    receiptCount: geomReceipts.length,
  };
}

export function measure(): { rows: Record<string, Row>; failures: string[] } {
  const rows: Record<string, Row> = {};
  const failures: string[] = [];
  const cfgDir = path.join(HERE, 'configs');
  for (const file of readdirSync(cfgDir).sort()) {
    if (!file.endsWith('.json')) continue;
    const lib = file.replace(/\.json$/, '');
    const cfg: CaptureConfig = loadConfig(REPO, path.join(cfgDir, file));
    const outRoot = path.join(REPO, (cfg as unknown as { outDir?: string }).outDir ?? `extract/computed/out/${lib}`);
    for (const comp of cfg.components as ComponentConfig[]) {
      const key = `${lib}/${comp.name}`;
      try {
        const row = measureOne(cfg, comp, outRoot);
        if (row) rows[key] = row;
      } catch (err) {
        // A component whose offline re-fuse THROWS is a finding, not a skip:
        // the census cannot see it, so nothing can.
        failures.push(`${key}: offline re-fuse threw — ${String((err as Error).message ?? err).slice(0, 200)}`);
      }
    }
  }
  return { rows, failures };
}

function main(): void {
  const write = process.argv.includes('--write');
  const { rows, failures } = measure();
  const keys = Object.keys(rows).sort();
  if (write) {
    writeFileSync(
      CENSUS,
      `${JSON.stringify(
        {
          _marker:
            'THE FUSION-SURFACE FRESHNESS RECORD. Re-derived offline from every committed captured-truth.json by extract/computed/fusion-geometry-census.ts. A row that moves means that component has been re-fused by a changed door and its committed enriched.*/LEDGER.md/contract are stale — see the header of that file for the per-library remedy.',
          generatedBy: 'extract/computed/fusion-geometry-census.ts --write',
          components: keys.length,
          rows: Object.fromEntries(keys.map((k) => [k, rows[k]])),
        },
        null,
        2,
      )}\n`,
    );
    console.log(`fusion-geometry-census: ${keys.length} components recorded → ${path.relative(REPO, CENSUS)}. This is an EXPLICIT act — review the diff.`);
    if (failures.length > 0) for (const f of failures) console.log(`  ! ${f}`);
    return;
  }
  if (!existsSync(CENSUS)) {
    console.error('✖ fusion-geometry-census: no committed census — run with `-- --write` once, deliberately.');
    process.exit(1);
  }
  const prev = JSON.parse(readFileSync(CENSUS, 'utf8')) as { rows: Record<string, Row> };
  const drift: string[] = [];
  for (const key of [...new Set([...keys, ...Object.keys(prev.rows)])].sort()) {
    const a = prev.rows[key];
    const b = rows[key];
    if (!a) { drift.push(`NEW ${key} — a component the census has never seen; re-record deliberately`); continue; }
    if (!b) { drift.push(`GONE ${key} — its committed captured-truth.json no longer re-fuses (or was removed)`); continue; }
    const carriedA = JSON.stringify(a.carried);
    const carriedB = JSON.stringify(b.carried);
    if (carriedA !== carriedB) {
      const parts = [...new Set([...Object.keys(a.carried), ...Object.keys(b.carried)])].sort();
      for (const p of parts) {
        const x = JSON.stringify(a.carried[p] ?? []);
        const y = JSON.stringify(b.carried[p] ?? []);
        if (x !== y) drift.push(`CARRIED ${key} · ${p}: ${x} → ${y} — the CONTRACT this component ships was fused by a different engine; it and everything emitted from it are stale`);
      }
    }
    if (a.receipts !== b.receipts) {
      drift.push(`RECEIPTS ${key}: ${a.receiptCount} line(s) hash ${a.receipts} → ${b.receiptCount} line(s) hash ${b.receipts} — the committed enriched.extension.json / LEDGER.md no longer say what the engine says`);
    }
  }
  for (const f of failures) drift.push(`THREW ${f}`);
  console.log(`fusion-geometry-census: ${keys.length} components re-fused offline from committed captured truth`);
  if (drift.length === 0) {
    console.log(`✔ no drift against ${path.relative(REPO, CENSUS)}`);
    return;
  }
  console.error(`\n✖ FUSION-SURFACE DRIFT — ${drift.length}`);
  for (const d of drift) console.error(`  - ${d}`);
  console.error(
    '\nREMEDY, per named component: npm run extract:computed -- --config extract/computed/configs/<lib>.json --component <Name>,\nthen the library floor-promote script, then re-emit its figma scripts + GENESIS-BATCH.\nRe-recording the census without re-deriving is legal but must be a deliberate, reviewable line in the diff:\n  npm run extract:computed:geometry:census -- --write',
  );
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
