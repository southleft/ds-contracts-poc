/**
 * RECORD A USABLE PROBE BATCH — `npx tsx extract/figma/census/usable-record.ts [--library <name>] <batch.json> [<batch.json> …]`
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
 *
 * TWO THINGS THE CANVAS FORCED (2026-08-26, the 162-row sweep):
 *
 * 1. `--library <name>`. The library is derived from the page name by stripping
 *    `Census / `, which works for every page except the one holding the antd
 *    sets — it is called `antd exam 2026-08-23`. Renaming a page on the owner's
 *    canvas to satisfy a script is the wrong direction, so a page that is NOT
 *    named `Census / <library>` must be given its library EXPLICITLY and is
 *    refused by name otherwise. The flag cannot file a batch under the wrong
 *    library: every set still has to match a row of that library and every row
 *    of that library still has to be matched, so a mis-aimed `--library` fails
 *    with 30-odd unmatched sets rather than writing a single wrong file.
 *
 * 2. SEVERAL BATCHES FOR ONE PAGE. `figma_execute` has a 30s ceiling and a
 *    bounded result, and `Census / first-party` is 54 sets — so a page may have
 *    to be probed in chunks. Splicing the observations together by hand would
 *    destroy the restoration proof, which is per batch, so this script does it
 *    and CHECKS it: the batches must be for the same page and file, each must
 *    carry `canvasRestored`, and each batch's `canvasAfter` signature must be
 *    the next one's `canvasBefore` — an unbroken chain from the first hash to
 *    the last, with the same signature at both ends. If the chain breaks, the
 *    canvas moved between chunks, nothing is written, and the break is named.
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

const USAGE =
  "usage: npx tsx extract/figma/census/usable-record.ts [--library <name>] <batch.json> [<batch.json> …]";

function main(): number {
  const argv = process.argv.slice(2);
  let libraryFlag: string | null = null;
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--library") {
      libraryFlag = argv[++i] ?? null;
      if (!libraryFlag) {
        console.error(`✘ --library needs a value\n${USAGE}`);
        return 2;
      }
      continue;
    }
    files.push(argv[i]);
  }
  if (files.length === 0) {
    console.error(USAGE);
    return 2;
  }
  const batches = files.map(
    (f) => JSON.parse(readFileSync(f, "utf8")) as Batch,
  );
  // Every batch must be the same page of the same file at the same probe
  // version — chunking a page is allowed, mixing two pages is not.
  const chainProblems: string[] = [];
  const head = batches[0];
  for (let i = 1; i < batches.length; i++) {
    const b = batches[i];
    if (b.page !== head.page)
      chainProblems.push(
        `${files[i]} is page ${JSON.stringify(b.page)}, ${files[0]} is ${JSON.stringify(head.page)} — one page per recording`,
      );
    if (b.fileKey !== head.fileKey)
      chainProblems.push(
        `${files[i]} was taken against file ${b.fileKey}, ${files[0]} against ${head.fileKey}`,
      );
    if (b.probeVersion !== head.probeVersion)
      chainProblems.push(
        `${files[i]} is probeVersion ${b.probeVersion}, ${files[0]} is ${head.probeVersion}`,
      );
  }
  // The restoration proof has to CHAIN across the chunks, or the composite
  // `canvasRestored` this script writes would be a claim nobody measured.
  for (let i = 0; i < batches.length; i++) {
    if (batches[i].canvasRestored !== true)
      chainProblems.push(
        `${files[i]} reports canvasRestored=${String(batches[i].canvasRestored)} (before ${batches[i].canvasBefore?.nodes}/${batches[i].canvasBefore?.sig}, after ${batches[i].canvasAfter?.nodes}/${batches[i].canvasAfter?.sig}) — the probe left the canvas altered; nothing from this batch may be committed`,
      );
    if (i > 0) {
      const prev = batches[i - 1];
      const cur = batches[i];
      if (
        prev.canvasAfter?.sig !== cur.canvasBefore?.sig ||
        prev.canvasAfter?.nodes !== cur.canvasBefore?.nodes
      )
        chainProblems.push(
          `the canvas changed between ${files[i - 1]} (after ${prev.canvasAfter?.nodes}/${prev.canvasAfter?.sig}) and ${files[i]} (before ${cur.canvasBefore?.nodes}/${cur.canvasBefore?.sig}) — the restoration proof does not chain, so these chunks are not one measurement of one page`,
        );
    }
  }
  const last = batches[batches.length - 1];
  const chained =
    head.canvasBefore?.sig === last.canvasAfter?.sig &&
    head.canvasBefore?.nodes === last.canvasAfter?.nodes;
  if (!chained)
    chainProblems.push(
      `the page is not as it was found: first batch before ${head.canvasBefore?.nodes}/${head.canvasBefore?.sig}, last batch after ${last.canvasAfter?.nodes}/${last.canvasAfter?.sig}`,
    );
  if (chainProblems.length > 0) {
    console.error(
      `✘ ${chainProblems.length} restoration/chain problem(s) — nothing written:\n${chainProblems.map((p) => `  - ${p}`).join("\n")}`,
    );
    return 1;
  }
  const batch: Batch = {
    page: head.page,
    fileKey: head.fileKey,
    probeVersion: head.probeVersion,
    canvasBefore: head.canvasBefore,
    canvasAfter: last.canvasAfter,
    canvasRestored: true,
    observations: batches.flatMap((b) => b.observations),
  };
  // The page names the library — unless it is not named `Census / <library>`,
  // in which case the caller must say which library it is, by name.
  if (libraryFlag === null && !batch.page.startsWith("Census / ")) {
    console.error(
      `✘ page ${JSON.stringify(batch.page)} is not named \`Census / <library>\`, so it cannot name its library — pass --library <name> (the sets and rows are cross-checked against it either way)\n${USAGE}`,
    );
    return 2;
  }
  const library = libraryFlag ?? batch.page.replace(/^Census \/ /, "");
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
