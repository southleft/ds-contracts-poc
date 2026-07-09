/**
 * Step 2+4+5 — propose (with minting) and emit both surfaces + the canvas
 * script, from the COMMITTED fixtures (replayable offline).
 *
 * Per subject, out/<id>/ gets:
 *   contract.json      the schema-parsed proposed contract
 *   proposal.json      notes + unbound + minted entries (the receipts)
 *   component.html/.css     emitHtml over the composed inventory (minted
 *                           layer included — token-source.ts composition)
 *   preview.html       self-contained document: tokens.css + mintedTokenCss
 *                      + emitted css + showcase html (the playground's
 *                      assembleDoc, light surface) — the screenshot target
 *   Component.tsx/.module.css/.stories.tsx   emitReact (the shipping
 *                      generator); a refusal is recorded, not hidden
 *   figma-script.js    emitFigmaScript with the minted preamble
 *   canvas-summary.json  compiled canvas spec facts (per-variant root fill
 *                      variable names) + the AsyncFunction syntax-check verdict
 *
 *   npx tsx extract/fidelity-matrix/scripts/propose-emit.ts [subject-id …]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ContractSchema,
  createFigmaEngine,
  emitFigmaScript,
  emitHtml,
  emitReact,
  mintedTokenCss,
  proposeFromCode,
  proposeFromDump,
  type Contract,
  type SourceFileInput,
} from '../../../core/index.js';
import { isDumpSet, type DumpFile, type DumpSet } from '../../figma/types.js';
import { MATRIX, composeMinted, loadRepoData, readJson } from './lib.js';
import { SUBJECTS } from './subjects.js';

const data = loadRepoData();

interface MintedShape {
  tree: Record<string, unknown>;
  count: number;
  entries: unknown[];
}

interface Proposed {
  contract: Contract;
  notes: string[];
  unbound: unknown[];
  minted: MintedShape | undefined;
}

function proposeFigmaSubject(id: string): Proposed {
  const dump = readJson(path.join(MATRIX, 'fixtures', id, 'dump.json')) as DumpFile;
  const fileKey = dump._provenance?.fileKey ?? null;
  const sets = Object.entries(dump).filter((e): e is [string, DumpSet] => e[0] !== '_provenance' && isDumpSet(e[1]));
  if (sets.length !== 1) throw new Error(`${id}: expected exactly one set in the dump, found ${sets.length}`);
  const result = proposeFromDump(sets[0][1], {
    corpus: data.corpus,
    contractIdByName: data.contractIdByName,
    fileKey,
    mintUnbound: true,
  });
  return {
    contract: ContractSchema.parse(result.contract),
    notes: result.notes,
    unbound: result.unbound,
    minted: result.mintedTokens,
  };
}

function proposeCodeSubject(id: string): Proposed {
  const trace = readJson(path.join(MATRIX, 'fixtures', id, 'trace.json')) as {
    files: SourceFileInput[];
    extraCss: string[];
  };
  const result = proposeFromCode(trace.files, {
    tokens: data.treesForCode,
    prefix: 'ds',
    mintUnbound: true,
    extraCss: trace.extraCss,
  });
  if (result.proposals.length === 0) {
    throw new Error(`${id}: no readable component — skipped: ${JSON.stringify(result.skipped)}`);
  }
  const first = result.proposals[0];
  return {
    contract: ContractSchema.parse(first.proposal.contract),
    notes: first.proposal.notes,
    unbound: [],
    minted: first.proposal.mintedTokens,
  };
}

/** The playground's assembleDoc, light surface, self-contained. */
function previewDoc(html: string, css: string, mintedCss: string): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head><meta charset="utf-8">',
    `<style>${data.tokensCss}</style>`,
    `<style>/* Minted provisional tokens (imported.*) — literal fidelity. */\n${mintedCss}</style>`,
    '<style>body { margin: 0; padding: 20px; background: #f5f5f5; color: #1a1a1a; font-family: var(--font-family-sans, system-ui, sans-serif); }</style>',
    `<style>${css}</style>`,
    '</head><body>',
    html,
    '</body></html>',
  ].join('\n');
}

function run(id: string, kind: 'figma' | 'code'): void {
  const outDir = path.join(MATRIX, 'out', id);
  mkdirSync(outDir, { recursive: true });
  const save = (name: string, contents: string) => writeFileSync(path.join(outDir, name), contents);

  const proposed = kind === 'figma' ? proposeFigmaSubject(id) : proposeCodeSubject(id);
  const { contract, minted } = proposed;
  save('contract.json', JSON.stringify(contract, null, 2) + '\n');
  save(
    'proposal.json',
    JSON.stringify(
      {
        notes: proposed.notes,
        unbound: proposed.unbound,
        minted: minted ? { count: minted.count, entries: minted.entries } : null,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`  props: ${contract.props.map((p) => p.name).join(', ') || '(none)'}`);
  console.log(`  minted: ${minted?.count ?? 0} provisional token(s); notes: ${proposed.notes.length}; unbound: ${proposed.unbound.length}`);

  const composed = composeMinted(data, minted);
  const contracts = new Map(data.contracts);
  contracts.set(contract.id, contract);

  // ---- html surface --------------------------------------------------------
  let htmlOk = false;
  try {
    const { html, css } = emitHtml(contract, { tokens: composed.inventory, icons: data.icons, contracts });
    save('component.html', html);
    save('component.css', css);
    save('preview.html', previewDoc(html, css, minted ? mintedTokenCss(minted.tree) : ''));
    htmlOk = true;
    console.log('  emitHtml: ok');
  } catch (e) {
    save('component.html.REFUSED.txt', String(e instanceof Error ? e.message : e) + '\n');
    console.log(`  emitHtml: REFUSED — ${(e as Error).message.split('\n')[0]}`);
  }

  // ---- react surface -------------------------------------------------------
  try {
    const { tsx, css, stories } = emitReact(contract, { tokens: composed.inventory, icons: data.icons, contracts });
    save('Component.tsx', tsx);
    save('Component.module.css', css);
    save('Component.stories.tsx', stories);
    console.log('  emitReact: ok');
  } catch (e) {
    save('Component.tsx.REFUSED.txt', String(e instanceof Error ? e.message : e) + '\n');
    console.log(`  emitReact: REFUSED — ${(e as Error).message.split('\n')[0]}`);
  }

  // ---- canvas surface ------------------------------------------------------
  const canvas: Record<string, unknown> = { htmlOk };
  try {
    const script = emitFigmaScript(contract, {
      tokens: composed.tokens,
      icons: data.icons,
      contracts,
      ...(minted ? { mintedTokens: minted.tree } : {}),
    });
    save('figma-script.js', script);
    let syntaxOk = true;
    try {
      new Function('return (async () => {\n' + script + '\n})()');
    } catch (e) {
      syntaxOk = false;
      canvas.syntaxError = e instanceof Error ? e.message : String(e);
    }
    canvas.script = { bytes: script.length, mintedPreamble: script.includes("'Imported (provisional)'"), syntaxOk };

    const engine = createFigmaEngine({ tokens: composed.tokens, icons: data.icons });
    const compiled = engine.compileComponentData(contract, contracts);
    canvas.compiled = {
      setName: compiled.setName,
      variants: compiled.variants.map((v) => ({
        name: v.name,
        rootFill: v.spec.fill ?? null,
        rootStroke: v.spec.stroke ?? null,
        bindings: v.spec.bindings ?? {},
      })),
    };
    console.log(`  figma script: ${script.length} bytes, syntax ${syntaxOk ? 'ok' : 'FAILED'}; canvas variants: ${compiled.variants.length}`);
  } catch (e) {
    canvas.error = e instanceof Error ? e.message : String(e);
    console.log(`  canvas: FAILED — ${(e as Error).message.split('\n')[0]}`);
  }
  save('canvas-summary.json', JSON.stringify(canvas, null, 2) + '\n');
}

const only = process.argv.slice(2);
for (const s of SUBJECTS) {
  if (only.length > 0 && !only.includes(s.id)) continue;
  console.log(`\n── ${s.label} ──`);
  try {
    run(s.id, s.kind);
  } catch (e) {
    console.error(`✖ ${s.id}: ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}
