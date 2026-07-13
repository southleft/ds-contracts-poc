/**
 * PHASE-1 PNG banking — fetch Figma's own renders (images API, scale=2,
 * disk-cached by node + file version, 30-id batches, 700ms politeness) for
 * every LIVE-GAUNTLET visual subject: all T3–T5 sets plus the T1/T2 sample.
 *
 * Reuses the visual-parity REST machinery verbatim (figma-api.ts). Cache
 * lands under extract/figma/gauntlet/live/out/_cache (gitignored) so the
 * visual stage (visual-live.ts) replays offline once banked.
 *
 * `npx tsx extract/figma/gauntlet/live/bank-pngs.ts` — needs FIGMA_TOKEN
 * (.env.local via the fidelity-matrix env resolver); never prints it.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fetchNodePngs, fetchSetInfos } from '../../visual-parity/figma-api.js';
import { tierSets, T12_VISUAL_SAMPLE } from './tiers.js';

const HERE = path.resolve(new URL('.', import.meta.url).pathname);
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(HERE, 'out');
const CACHE = path.join(OUT, '_cache');
const DUMP = path.join(ROOT, 'extract', 'figma', 'fixtures', 'cbds-plugin-all-sets.v16.dump.json');
const FILE_KEY = 'WofZT8xaxXuc2Q6Je9S4XE';

async function main(): Promise<void> {
  mkdirSync(CACHE, { recursive: true });
  const dump = JSON.parse(readFileSync(DUMP, 'utf8')) as Record<string, unknown>;
  const tiers = tierSets(dump);
  const subjects = tiers.filter(
    (t) => t.tier === 'T3' || t.tier === 'T4' || t.tier === 'T5' || T12_VISUAL_SAMPLE.has(t.setName),
  );
  console.log(`banking PNGs for ${subjects.length} sets (${subjects.reduce((a, t) => a + t.variants, 0)} drawn variants)`);

  // fetchSetInfos batches its ids into ONE nodes call — 71 full set subtrees
  // in one response exceeds Node's max string length. Chunk the calls (cache
  // layout is per-set, so chunking outside the helper is transparent).
  const infos = new Map<string, Awaited<ReturnType<typeof fetchSetInfos>> extends Map<string, infer V> ? V : never>();
  const ids = subjects.map((s) => s.nodeId);
  const NODES_PER_CALL = 5;
  for (let i = 0; i < ids.length; i += NODES_PER_CALL) {
    const chunk = ids.slice(i, i + NODES_PER_CALL);
    const got = await fetchSetInfos(CACHE, FILE_KEY, chunk, false);
    for (const [k, v] of got) infos.set(k, v);
    console.log(`  nodes ${Math.min(i + NODES_PER_CALL, ids.length)}/${ids.length}`);
  }
  let banked = 0;
  let declined = 0;
  const declinedRows: Array<{ set: string; variant: string }> = [];
  for (const subject of subjects) {
    const info = infos.get(subject.nodeId);
    if (!info) {
      console.log(`  ✗ ${subject.setName}: no set info`);
      continue;
    }
    const pngs = await fetchNodePngs(CACHE, FILE_KEY, subject.nodeId, info.version, info.variants.map((v) => v.nodeId));
    let ok = 0;
    for (const v of info.variants) {
      if (pngs.get(v.nodeId)) ok++;
      else {
        declined++;
        declinedRows.push({ set: subject.setName, variant: v.name });
      }
    }
    banked += ok;
    console.log(`  · ${subject.setName} (${subject.tier}): ${ok}/${info.variants.length} PNGs (file v${info.version})`);
  }
  writeFileSync(
    path.join(OUT, 'png-bank-manifest.json'),
    JSON.stringify({ bankedAt: new Date().toISOString(), subjects: subjects.length, banked, declined, declinedRows }, null, 2),
  );
  console.log(`\nbanked ${banked} PNGs (${declined} declined by the images API — named in png-bank-manifest.json)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
