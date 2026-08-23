/**
 * Emit first-party figma-sync scripts retargeted at DS-Contracts-Testing
 * for the Console MCP generate→screenshot→audit→round-trip loop.
 * Does NOT touch golden figma-sync/ (evals pin those bytes).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, sortByDependencies } from './contract-schema.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'parity/receipts/console-loop/emitted');
const FILE_KEY = process.env.FIGMA_FILE_KEY ?? 'GnQnjSNBXtgtd2Ht0Hs1C8';

/**
 * All first-party contracts except bindings.figma.representation:native.
 * Override with CONSOLE_LOOP_COMPONENTS=a,b,c for a subset.
 */
const DEFAULT_STEMS = [
  'badge',
  'switch',
  'card',
  'button',
  'checkbox',
  'avatar',
  'avatar-group',
  'banner',
  'slider',
  'tab',
  'tab-list',
  'progress-bar',
  'spinner',
  'divider',
  'icon-button',
  'field',
  'text-field',
  'text-area',
  'accordion-item',
  'status-dot',
  'skeleton',
  'toast',
  'pagination',
  'blockquote',
  'breadcrumb-item',
  'breadcrumbs',
  'chat-message',
  'chat-message-metadata',
  'chat-system-message',
  'citation',
  'code',
  'empty-state',
  'heading',
  'kbd',
  'list',
  'list-item',
  'metadata-list',
  'metadata-list-item',
  'section',
  'side-nav-item',
  'table',
  'table-cell',
  'table-header-cell',
  'table-row',
  'token',
  'toolbar',
  'top-nav',
  'top-nav-item',
  'typeahead-item',
];

const want = new Set(
  (process.env.CONSOLE_LOOP_COMPONENTS ?? DEFAULT_STEMS.join(','))
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

const brandNames = readdirSync(path.join(ROOT, 'tokens', 'modes'))
  .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
  .map((f) => f.replace(/^brand\.|\.tokens\.json$/g, ''));

const iconAssets = new Map<string, string>();
{
  const dir = path.join(ROOT, 'assets', 'icons');
  try {
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.svg')) {
        iconAssets.set(f.replace(/\.svg$/, ''), readFileSync(path.join(dir, f), 'utf8').trim());
      }
    }
  } catch {
    /* no icons */
  }
}

const engine = createFigmaEngine({
  tokens: {
    primitives: read('tokens/primitives.tokens.json'),
    semantic: read('tokens/semantic.tokens.json'),
    light: read('tokens/modes/semantic.light.tokens.json'),
    dark: read('tokens/modes/semantic.dark.tokens.json'),
    brands: Object.fromEntries(brandNames.map((n) => [n, read(`tokens/modes/brand.${n}.tokens.json`)])),
  },
  icons: iconAssets,
});

mkdirSync(OUT, { recursive: true });

const contracts = readdirSync(path.join(ROOT, 'contracts'))
  .filter((f) => f.endsWith('.contract.json'))
  .map((f) => ContractSchema.parse(read(path.join('contracts', f))));

for (const c of contracts) {
  if (c.bindings?.figma?.anchors) {
    c.bindings.figma.anchors = {
      ...c.bindings.figma.anchors,
      fileKey: FILE_KEY,
      nodeId: null,
      componentSetKey: null,
    };
  }
}

writeFileSync(path.join(OUT, '01-tokens.js'), engine.buildTokensScript(FILE_KEY));
const ordered = sortByDependencies(contracts);
const byId = new Map(contracts.map((c) => [c.id, c]));

let index = 2;
const emitted: string[] = ['01-tokens.js'];
const skipped: string[] = [];

for (const contract of ordered) {
  if (contract.bindings.figma.representation === 'native') {
    skipped.push(`${contract.name} (native)`);
    continue;
  }
  const stem = contract.name.toLowerCase().replace(/\s+/g, '-');
  const idStem = contract.id.replace(/^ds\./, '').toLowerCase();
  if (!want.has(stem) && !want.has(idStem) && !want.has(stem.replace(/-/g, ''))) {
    continue;
  }
  const outName = `${String(index).padStart(2, '0')}-${stem.replace(/-/g, '')}.js`;
  writeFileSync(path.join(OUT, outName), engine.buildComponentScript(contract, byId, FILE_KEY));
  emitted.push(outName);
  index++;
}

writeFileSync(
  path.join(OUT, 'manifest.json'),
  JSON.stringify(
    {
      fileKey: FILE_KEY,
      fileUrl: `https://www.figma.com/design/${FILE_KEY}/DS-Contracts-Testing`,
      emittedAt: new Date().toISOString(),
      scripts: emitted.map((name) => ({
        name,
        bytes: readFileSync(path.join(OUT, name)).length,
      })),
      skipped,
    },
    null,
    2,
  ),
);

for (const name of emitted) {
  console.log(name, readFileSync(path.join(OUT, name)).length);
}
console.log(`✔ console-loop emitted ${emitted.length} scripts → ${OUT}`);
