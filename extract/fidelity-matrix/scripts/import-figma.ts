/**
 * Step 1 (Figma subjects) — the REAL import path, instrumented for receipts.
 *
 * Runs extract/figma/rest/fetch.ts importFromUrl (the exact function the CLI
 * `npm run extract:figma:rest` and the playground both run) with a capturing
 * fetchImpl, so ONE live call yields, per subject:
 *
 *   fixtures/<id>/rest-nodes.json   the raw GET /v1/files/:key/nodes response
 *                                   (source truth: componentPropertyDefinitions
 *                                   ride the set's document node)
 *   fixtures/<id>/variables.json    the variables/local body when the plan
 *                                   allows it, else { status } — the 403 is
 *                                   the expected degradation, receipted
 *   fixtures/<id>/dump.json         dump v1 (what the CLI writes to --out)
 *   fixtures/<id>/map-report.json   the MapReport — every degradation, named
 *
 * The token never lands in any file: fetchImpl strips headers before capture.
 *
 *   npx tsx extract/fidelity-matrix/scripts/import-figma.ts [subject-id …]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { importFromUrl, type FetchLike } from '../../figma/rest/fetch.js';
import { figmaToken } from './env.js';
import { figmaSubjects } from './subjects.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const FIXTURES = path.join(ROOT, 'fixtures');

const save = (dir: string, name: string, value: unknown) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n');
};

async function importOne(id: string, url: string, token: string): Promise<void> {
  const dir = path.join(FIXTURES, id);
  const captures: Array<{ url: string; status: number; body: unknown }> = [];
  const fetchImpl: FetchLike = async (reqUrl, init) => {
    const res = await fetch(reqUrl, { headers: init?.headers });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    captures.push({ url: reqUrl, status: res.status, body });
    return {
      ok: res.ok,
      status: res.status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(text),
    };
  };

  const { dump, report } = await importFromUrl(url, token, { fetchImpl });

  const nodesCapture = captures.find((c) => c.url.includes('/nodes?ids='));
  const variablesCapture = captures.find((c) => c.url.includes('/variables/local'));
  if (nodesCapture) save(dir, 'rest-nodes.json', nodesCapture.body);
  save(
    dir,
    'variables.json',
    variablesCapture && variablesCapture.status === 200
      ? variablesCapture.body
      : { status: variablesCapture?.status ?? null, note: 'variables/local unavailable — the expected non-Enterprise degradation' },
  );
  save(dir, 'dump.json', dump);
  save(dir, 'map-report.json', report);

  console.log(`✔ ${id}: ${report.sets.length} set(s) [${report.sets.join(', ')}]`);
  console.log(`  variables/local → ${variablesCapture?.status ?? 'not called'}`);
  console.log(`  degradations: ${report.degradations.length}, notes: ${report.notes.length}`);
}

async function main(): Promise<void> {
  const only = process.argv.slice(2);
  const token = figmaToken();
  for (const s of figmaSubjects) {
    if (only.length > 0 && !only.includes(s.id)) continue;
    console.log(`\n── ${s.label} ──`);
    try {
      await importOne(s.id, s.url, token);
    } catch (e) {
      console.error(`✖ ${s.id}: ${e instanceof Error ? e.message : e}`);
      process.exitCode = 1;
    }
  }
}

main();
