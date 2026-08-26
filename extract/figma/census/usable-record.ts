/**
 * RECORD A USABLE PROBE BATCH — `npx tsx extract/figma/census/usable-record.ts <batch.json>`
 *
 * The agent runs `usable-probe.plugin.js` through `figma_execute` (one call
 * per `Census / <library>` page, every set on that page in one batch) and
 * saves the returned object. This splits it into one committed observation
 * per census row, `parity/receipts/v1/usable/<library>/<id>.json`, which is
 * what `npm run canvas:usable:check` reads.
 *
 * The batch's page name names the library; each observation is matched to its
 * manifest row by set name (`<Name>` or `<Name> (<id>)`). A set that matches
 * no row, and a row that no set matched, are both REPORTED — a probe result
 * cannot go into the census under the wrong id, and one cannot vanish.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { MANIFEST_PATH, REPO, type CensusManifest } from "./corpus.js";
import { USABLE_DIR, type UsableObservation } from "./usable.js";

interface Batch {
  page: string;
  fileKey: string;
  probeVersion: number;
  canvasBefore: { nodes: number; sig: string };
  canvasAfter: { nodes: number; sig: string };
  canvasRestored: boolean;
  observations: UsableObservation[];
}

function main(): number {
  const file = process.argv[2];
  if (!file) {
    console.error(
      "usage: npx tsx extract/figma/census/usable-record.ts <batch.json>",
    );
    return 2;
  }
  const batch = JSON.parse(readFileSync(file, "utf8")) as Batch;
  const library = batch.page.replace(/^Census \/ /, "");
  const manifest = JSON.parse(
    readFileSync(path.join(REPO, MANIFEST_PATH), "utf8"),
  ) as CensusManifest;
  const rows = manifest.rows.filter((r) => r.library === library);
  if (rows.length === 0) {
    console.error(
      `✘ no census rows for library ${JSON.stringify(library)} (page ${JSON.stringify(batch.page)})`,
    );
    return 1;
  }
  const matched = new Set<string>();
  const problems: string[] = [];
  for (const o of batch.observations) {
    const row =
      rows.find((r) => o.setName === `${r.name} (${r.id})`) ??
      rows.find((r) => o.setName === r.name) ??
      rows.find((r) => o.setName.startsWith(`${r.name} (`));
    if (!row) {
      problems.push(
        `set ${JSON.stringify(o.setName)} (${o.setNodeId}) matches no ${library} census row`,
      );
      continue;
    }
    if (matched.has(row.id)) {
      problems.push(
        `two sets claim ${row.id}; the second is ${JSON.stringify(o.setName)} (${o.setNodeId})`,
      );
      continue;
    }
    matched.add(row.id);
    const out = path.join(REPO, USABLE_DIR, library, `${row.id}.json`);
    mkdirSync(path.dirname(out), { recursive: true });
    const record: UsableObservation = {
      ...o,
      canvasBefore: batch.canvasBefore,
      canvasAfter: batch.canvasAfter,
      canvasRestored: batch.canvasRestored,
    };
    writeFileSync(out, JSON.stringify(record, null, 2) + "\n");
    console.log(`wrote ${path.relative(REPO, out)} ← ${o.setName}`);
  }
  for (const r of rows)
    if (!matched.has(r.id))
      problems.push(
        `census row ${r.library}/${r.id} (${r.name}) was not probed by this batch`,
      );
  if (problems.length > 0) {
    console.error(
      `✘ ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
    return 1;
  }
  console.log(`✔ recorded ${matched.size}/${rows.length} ${library} rows`);
  return 0;
}

process.exit(main());
