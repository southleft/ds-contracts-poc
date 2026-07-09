/**
 * Step 3a — ground-truth PNG per Figma subject via the Figma images API.
 * The COMPONENT_SET node is rendered at scale=1 (the whole variant grid —
 * the same thing the dump captured). Token stays node-side (env.ts).
 *
 *   npx tsx extract/fidelity-matrix/scripts/capture-figma-png.ts
 *
 * Writes out/<id>/figma.png (small; grid at 1x).
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { figmaToken } from './env.js';
import { MATRIX, readJson } from './lib.js';
import { figmaSubjects } from './subjects.js';

const token = figmaToken();

for (const s of figmaSubjects) {
  const dump = readJson(path.join(MATRIX, 'fixtures', s.id, 'dump.json')) as {
    _provenance?: { fileKey?: string };
  };
  const fileKey = dump._provenance?.fileKey ?? new URL(s.url).pathname.split('/')[2];
  const api = `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(s.nodeId)}&format=png&scale=1`;
  const res = await fetch(api, { headers: { 'X-Figma-Token': token } });
  if (!res.ok) {
    console.error(`✖ ${s.id}: images API ${res.status}`);
    process.exitCode = 1;
    continue;
  }
  const body = (await res.json()) as { images: Record<string, string | null> };
  const url = body.images[s.nodeId];
  if (!url) {
    console.error(`✖ ${s.id}: no image URL returned`);
    process.exitCode = 1;
    continue;
  }
  const png = await fetch(url);
  const buf = Buffer.from(await png.arrayBuffer());
  writeFileSync(path.join(MATRIX, 'out', s.id, 'figma.png'), buf);
  console.log(`✓ ${s.id}: figma.png ${(buf.length / 1024).toFixed(0)} KB`);
}
