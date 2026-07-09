/**
 * Offline fixture remap — re-run the REST→dump mapper over the COMMITTED
 * rest-nodes.json (+ variables.json when the plan allowed it), rewriting
 * dump.json and map-report.json in place. This is how a mapper improvement
 * (e.g. dump v1.1 paint-alpha capture) reaches the committed fixtures
 * without a live Figma call — the raw REST capture is the durable truth.
 *
 * Only subjects with a committed rest-nodes.json are eligible
 * (cbds-button-design's raw response was not committed — see its
 * rest-nodes.NOT-COMMITTED.txt).
 *
 *   npx tsx extract/fidelity-matrix/scripts/remap-fixtures.ts [subject-id …]
 */
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  mapRestToDump,
  type RestNodesResponse,
  type RestVariablesResponse,
} from '../../figma/rest/map.js';
import { MATRIX, readJson } from './lib.js';
import { figmaSubjects } from './subjects.js';

const only = process.argv.slice(2);
for (const s of figmaSubjects) {
  if (only.length > 0 && !only.includes(s.id)) continue;
  const dir = path.join(MATRIX, 'fixtures', s.id);
  const nodesPath = path.join(dir, 'rest-nodes.json');
  if (!existsSync(nodesPath)) {
    console.log(`− ${s.id}: no committed rest-nodes.json — skipped (raw capture not committed)`);
    continue;
  }
  const nodes = readJson(nodesPath) as RestNodesResponse;
  const variablesRaw = readJson(path.join(dir, 'variables.json')) as RestVariablesResponse & {
    status?: number;
  };
  const variables = variablesRaw.meta?.variables ? variablesRaw : undefined;
  const fileKey = new URL(s.url).pathname.split('/')[2] ?? null;
  const { dump, report } = mapRestToDump(nodes, { ...(variables ? { variables } : {}), fileKey });
  writeFileSync(path.join(dir, 'dump.json'), JSON.stringify(dump, null, 2) + '\n');
  writeFileSync(path.join(dir, 'map-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(
    `✔ ${s.id}: remapped — ${report.sets.length} set(s), ${report.degradations.length} degradation(s), ${report.notes.length} note(s)`,
  );
}
