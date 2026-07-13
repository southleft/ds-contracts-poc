/**
 * LIVE-GAUNTLET VISUAL STAGE — every T3–T5 set (plus the T1/T2 sample)
 * rendered per variant from the emit-html preview in headless Chromium and
 * pixelmatched against the BANKED Figma PNGs (bank-pngs.ts, images API
 * scale=2, cached by node + file version — offline once banked).
 *
 * Reuses the visual-parity machinery verbatim (compose/render/img/match/
 * figma-api); subjects are generated from the tier table with the
 * children-first dep closure as session SCOPE (dump v1.5 linking), so
 * composites render REAL linked children exactly like the playground.
 *
 * Rows land in live-baseline.json — a SEPARATE file; the standing
 * visual-parity baseline.json is never touched. Triptychs are written for
 * the worst 20 rows only (out/ is gitignored).
 *
 * `npx tsx extract/figma/gauntlet/live/visual-live.ts [subjectSlug…]`
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RenderablePackage } from '../../visual-parity/compose.js';
import { composeSubjectLive } from './visual-compose.js';
import { fetchNodePngs, fetchSetInfos, type SetInfo } from '../../visual-parity/figma-api.js';
import { alignPair, diffPair, readPng, writeTriptych } from '../../visual-parity/img.js';
import { planVariant, variantSlug } from '../../visual-parity/match.js';
import { launchBrowser, renderVariant } from '../../visual-parity/render.js';
import type { DumpSubject } from '../../visual-parity/subjects.js';
import { sampleSingles, tierSets, T12_VISUAL_SAMPLE, type TierRecord } from './tiers.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(HERE, 'out');
// PNG/nodes cache lives OUTSIDE extract/ (evals/.scratch copies extract/
// recursively per reset — a 1GB cache in-tree makes every eval reset crawl).
const CACHE = path.join(ROOT, '.gauntlet-live-cache');
const DUMP_REL = 'extract/figma/fixtures/cbds-plugin-all-sets.v16.dump.json';
const FILE_KEY = 'WofZT8xaxXuc2Q6Je9S4XE';
const TRIPTYCH_WORST = 20;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

interface Row {
  subject: string;
  tier: string;
  variant: string;
  status: 'diffed' | 'skipped' | 'refused' | 'figma-declined';
  unmaskedPct?: number;
  maskedPct?: number;
  sizeOurs?: string;
  sizeFigma?: string;
  interaction?: string;
  diagnosis: string;
}

/** depOrder (gauntlet.ts convention): recursive childSets closure, leaf-first. */
function depOrder(tierByName: Map<string, TierRecord>, setName: string): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const visit = (name: string, chain: Set<string>): void => {
    if (seen.has(name) || chain.has(name)) return;
    for (const dep of tierByName.get(name)?.childSets ?? []) visit(dep, new Set([...chain, name]));
    seen.add(name);
    order.push(name);
  };
  for (const dep of tierByName.get(setName)?.childSets ?? []) visit(dep, new Set([setName]));
  return order;
}

async function main(): Promise<void> {
  const only = process.argv.slice(2);
  mkdirSync(OUT, { recursive: true });
  mkdirSync(CACHE, { recursive: true });
  const dump = JSON.parse(readFileSync(path.join(ROOT, DUMP_REL), 'utf8')) as Record<string, unknown>;
  const tiers = tierSets(dump);
  const tierByName = new Map(tiers.map((t) => [t.setName, t]));
  const picked = tiers.filter(
    (t) => t.tier === 'T3' || t.tier === 'T4' || t.tier === 'T5' || T12_VISUAL_SAMPLE.has(t.setName),
  );

  const subjects: Array<{ subject: DumpSubject; tier: string }> = picked.map((t) => ({
    tier: t.tier,
    subject: {
      id: `live-${slug(t.setName)}`,
      label: `${t.setName} (live ${t.tier})`,
      kind: 'dump' as const,
      dumpPath: DUMP_REL,
      set: t.setName,
      scope: depOrder(tierByName, t.setName)
        .filter((d) => d !== t.setName)
        .map((d) => ({ dumpPath: DUMP_REL, set: d })),
      fileKey: FILE_KEY,
      setNodeId: t.nodeId,
    },
  }));
  const run = subjects.filter((s) => only.length === 0 || only.includes(s.subject.id));
  console.log(`visual-live: ${run.length} subjects`);

  // Set infos — chunked (the cache from bank-pngs.ts makes this a replay).
  const infos = new Map<string, SetInfo>();
  const ids = run.map((s) => s.subject.setNodeId);
  for (let i = 0; i < ids.length; i += 5) {
    const got = await fetchSetInfos(CACHE, FILE_KEY, ids.slice(i, i + 5), false);
    for (const [k, v] of got) infos.set(k, v);
  }

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 });
  const rows: Row[] = [];
  const triptychCandidates: Array<{ row: Row; ours: Buffer; figmaPath: string; textRects: never }> = [];

  for (const { subject, tier } of run) {
    const info = infos.get(subject.setNodeId);
    if (!info) {
      rows.push({ subject: subject.id, tier, variant: '(all)', status: 'refused', diagnosis: 'no set info' });
      continue;
    }
    let pkg: RenderablePackage;
    try {
      pkg = composeSubjectLive(subject);
    } catch (e) {
      const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
      console.log(`✗ ${subject.id}: compose/propose REFUSED — ${msg}`);
      rows.push({ subject: subject.id, tier, variant: '(all)', status: 'refused', diagnosis: `proposal refused: ${msg}` });
      continue;
    }
    const pngs = await fetchNodePngs(CACHE, FILE_KEY, subject.setNodeId, info.version, info.variants.map((v) => v.nodeId));
    let diffed = 0;
    let skipped = 0;
    let worst = 0;
    for (const variant of info.variants) {
      const plan = planVariant(pkg.contract, variant.name);
      if (!plan.ok) {
        rows.push({ subject: subject.id, tier, variant: variant.name, status: 'skipped', diagnosis: plan.reason });
        skipped++;
        continue;
      }
      const figmaPngPath = pngs.get(variant.nodeId);
      if (!figmaPngPath) {
        rows.push({ subject: subject.id, tier, variant: variant.name, status: 'figma-declined', diagnosis: 'images API returned null' });
        continue;
      }
      let rendered: Awaited<ReturnType<typeof renderVariant>>;
      try {
        rendered = await renderVariant(page, pkg, plan.subst, plan.bools, plan.interaction, info.fontFamilies);
      } catch (e) {
        rendered = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      if (!rendered.ok) {
        rows.push({
          subject: subject.id,
          tier,
          variant: variant.name,
          status: 'refused',
          diagnosis: `render refused: ${rendered.error.split('\n').slice(0, 2).join(' ').trim()}`,
        });
        continue;
      }
      const aligned = alignPair(readPng(rendered.png), readPng(figmaPngPath));
      const diff = diffPair(aligned, rendered.textRects);
      const row: Row = {
        subject: subject.id,
        tier,
        variant: variant.name,
        status: 'diffed',
        unmaskedPct: diff.unmaskedPct,
        maskedPct: diff.maskedPct ?? undefined,
        sizeOurs: `${aligned.aContent.width}×${aligned.aContent.height}`,
        sizeFigma: `${aligned.bContent.width}×${aligned.bContent.height}`,
        interaction: plan.interaction === 'none' ? '' : plan.interaction,
        diagnosis: '',
      };
      rows.push(row);
      diffed++;
      worst = Math.max(worst, diff.maskedPct ?? diff.unmaskedPct ?? 0);
      // Keep bytes for worst-N triptychs, ranked at the end.
      triptychCandidates.push({ row, ours: rendered.png, figmaPath: figmaPngPath, textRects: rendered.textRects as never });
      if (triptychCandidates.length > 400) {
        triptychCandidates.sort((a, b) => (b.row.maskedPct ?? 0) - (a.row.maskedPct ?? 0));
        triptychCandidates.length = 100;
      }
    }
    console.log(`· ${subject.id} (${tier}): ${diffed} diffed, ${skipped} skipped, worst masked ${worst.toFixed(2)}%`);
  }
  await browser.close();

  // Worst-N triptychs.
  triptychCandidates.sort((a, b) => (b.row.maskedPct ?? 0) - (a.row.maskedPct ?? 0));
  const tripDir = path.join(OUT, 'triptychs');
  mkdirSync(tripDir, { recursive: true });
  for (const c of triptychCandidates.slice(0, TRIPTYCH_WORST)) {
    try {
      const aligned = alignPair(readPng(c.ours), readPng(c.figmaPath));
      const diff = diffPair(aligned, c.textRects);
      writeTriptych(path.join(tripDir, `${c.row.subject}--${variantSlug(c.row.variant)}.triptych.png`), aligned, diff.diff);
    } catch {
      /* triptych is best-effort */
    }
  }

  // Distribution + live baseline.
  const diffedRows = rows.filter((r) => r.status === 'diffed');
  const scores = diffedRows.map((r) => r.maskedPct ?? r.unmaskedPct ?? 0).sort((a, b) => a - b);
  const q = (p: number) => (scores.length ? scores[Math.min(scores.length - 1, Math.floor(p * scores.length))] : 0);
  const buckets = {
    '≤2%': scores.filter((s) => s <= 2).length,
    '2–5%': scores.filter((s) => s > 2 && s <= 5).length,
    '5–10%': scores.filter((s) => s > 5 && s <= 10).length,
    '>10%': scores.filter((s) => s > 10).length,
  };
  const summary = {
    subjects: run.length,
    rows: rows.length,
    diffed: diffedRows.length,
    skipped: rows.filter((r) => r.status === 'skipped').length,
    refused: rows.filter((r) => r.status === 'refused').length,
    figmaDeclined: rows.filter((r) => r.status === 'figma-declined').length,
    maskedMedian: q(0.5),
    maskedP90: q(0.9),
    maskedMax: scores[scores.length - 1] ?? 0,
    buckets,
  };
  writeFileSync(
    path.join(HERE, 'live-baseline.json'),
    JSON.stringify(
      {
        _provenance: {
          generatedBy: 'extract/figma/gauntlet/live/visual-live.ts',
          dump: DUMP_REL,
          note: 'LIVE-GAUNTLET visual rows — separate from the standing visual-parity baseline.json (ε-gated, untouched by this file).',
          generatedAt: new Date().toISOString().slice(0, 10),
        },
        summary,
        rows,
      },
      null,
      1,
    ) + '\n',
  );
  console.log(`\n${diffedRows.length} diffed — masked median ${summary.maskedMedian.toFixed(2)}% | p90 ${summary.maskedP90.toFixed(2)}% | max ${summary.maskedMax.toFixed(2)}%`);
  console.log(`buckets: ${JSON.stringify(buckets)}`);
  const worst10 = [...diffedRows].sort((a, b) => (b.maskedPct ?? 0) - (a.maskedPct ?? 0)).slice(0, 10);
  for (const r of worst10) console.log(`  ✗ ${r.subject} :: ${r.variant} — masked ${(r.maskedPct ?? 0).toFixed(2)}% (ours ${r.sizeOurs} vs figma ${r.sizeFigma})`);
  console.log(`wrote live-baseline.json + worst-${TRIPTYCH_WORST} triptychs under out/triptychs/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
