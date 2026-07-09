/**
 * Step 1 (code subject) — the REAL code-import path, node-side.
 *
 * Mirrors what the playground's GitHub import runs, function-for-function:
 * traceFromGithubUrl (entry TSX + traced relative imports + attached
 * stylesheets) and discoverTokenStylesheets (the :root vocabulary foreign
 * var()s mint against) from playground/src/engine/github-import.ts — that
 * module is browser-pure (global fetch only), so node 20+ runs it as-is.
 *
 * Output per code subject:
 *   fixtures/<id>/trace.json   SourceFileInput[] + notes + gaps + extraCss —
 *                              the committed, replayable input for
 *                              proposeFromCode (same shape the playground
 *                              hands it).
 *
 *   npx tsx extract/fidelity-matrix/scripts/import-code.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  discoverTokenStylesheets,
  traceFromGithubUrl,
} from '../../../playground/src/engine/github-import.js';
import { codeSubjects } from './subjects.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);

async function main(): Promise<void> {
  for (const s of codeSubjects) {
    console.log(`\n── ${s.label} ──`);
    const trace = await traceFromGithubUrl(s.url);
    const discovery = await discoverTokenStylesheets(trace);
    const dir = path.join(ROOT, 'fixtures', s.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'trace.json'),
      JSON.stringify(
        {
          url: s.url,
          sourcePath: trace.sourcePath,
          files: trace.files,
          notes: [...trace.notes, ...discovery.notes],
          gaps: [...trace.gaps, ...discovery.gaps],
          extraCss: discovery.extraCss,
          extraCssPaths: discovery.paths,
        },
        null,
        2,
      ) + '\n',
    );
    console.log(`✔ ${s.id}: ${trace.files.length} file(s), extraCss: ${discovery.paths.join(', ') || 'none'}`);
    for (const n of [...trace.notes, ...discovery.notes]) console.log(`  note: ${n}`);
    for (const g of [...trace.gaps, ...discovery.gaps]) console.log(`  gap: ${g}`);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
