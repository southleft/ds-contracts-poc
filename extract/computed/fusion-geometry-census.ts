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
 *   3. `extensionFresh` — whether that component's COMMITTED
 *      `enriched.extension.json` still agrees with the engine TODAY. This is
 *      a different axis from (1) and (2): those compare the engine against
 *      THIS FILE, so they move when a door changes; this one compares the
 *      engine against the SHIPPED ARTIFACT, so it also sees a component
 *      whose capture simply predates a door nobody re-ran.
 *
 *      MEASURED, and it is the reason this is pinned as DATA and not asserted
 *      as a bar: on the engine as it stands 83 of 104 components are already
 *      stale on this axis, and 83 of those 83 are stale on the PREVIOUS
 *      engine too (`git show <base>:extract/computed/fuse.ts` swapped in,
 *      `--write`, diffed) — i.e. the rot predates every door on this branch
 *      and belongs to captures taken months before the doors that now read
 *      them. Demanding a hand-written excuse for each would be 83 essays
 *      about other people's work, and demanding they be re-derived would be
 *      a capture wave, not an engine patch.
 *
 *      So the flag is RECORDED per row and compared like every other field.
 *      A component that is fresh today and stale tomorrow moves
 *      `true → false` and the gate names it; a component repaired by a
 *      re-derivation moves `false → true` and the gate names that too, so
 *      neither direction can happen silently. The pre-existing 83 sit in the
 *      committed file as 83 visible `"extensionFresh": false` lines instead
 *      of being invisible.
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
  /** Whether the COMMITTED enriched.extension.json's geometry receipts agree
   *  with what the engine says today. `false` means that component's shipped
   *  drop ledger is stale. Pinned as data, not asserted as a bar — see the
   *  header: the majority of the corpus is already stale on this axis on the
   *  PREVIOUS engine too, so what this catches is a CHANGE in either
   *  direction, which is the thing that can be silent. */
  extensionFresh: boolean;
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
  // THE COMMITTED DROP LEDGER, compared against what the engine says now. This
  // is the half the adversarial review named: an engine edit leaves the shipped
  // enriched.extension.json saying something the engine no longer says, and no
  // downstream gate can see it because they all read the committed artifacts.
  const extPath = path.join(outRoot, comp.name.toLowerCase(), 'enriched.extension.json');
  let extensionFresh = true;
  if (existsSync(extPath)) {
    const ext = JSON.parse(readFileSync(extPath, 'utf8')) as { styledChannelReceipts?: string[] };
    const committed = (ext.styledChannelReceipts ?? []).filter((r) => GEOMETRY_RECEIPT.test(r)).sort();
    extensionFresh = committed.join('\n') === geomReceipts.join('\n');
  }
  return {
    carried,
    receipts: createHash('sha256').update(geomReceipts.join('\n')).digest('hex').slice(0, 16),
    receiptCount: geomReceipts.length,
    extensionFresh,
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
          __extensionFresh:
            "Per row: whether that component's COMMITTED enriched.extension.json geometry receipts still match the engine. A `false` here is a component whose shipped drop ledger is stale — mostly captures that predate a door nobody re-ran, measured as 83 of 104 on the previous engine as well. It is pinned so that a CHANGE in either direction is red and has to be re-recorded deliberately.",
          extensionsStale: keys.filter((k) => !rows[k].extensionFresh).length,
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
    if ((a.extensionFresh ?? true) !== b.extensionFresh) {
      drift.push(
        b.extensionFresh
          ? `EXTENSION-REPAIRED ${key} — its committed enriched.extension.json now AGREES with the engine again (it did not before). A repair is as reviewable as a rot: re-record the census deliberately.`
          : `EXTENSION-STALE ${key} — its committed enriched.extension.json's geometry receipts NO LONGER match the engine. Re-derive the component (remedy below), or re-record the census deliberately and own the staleness in the diff.`,
      );
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
