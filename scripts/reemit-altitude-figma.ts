/**
 * ALTITUDE-ONLY re-emit of the canvas sync scripts.
 *
 * `scripts/reemit-visual-fixes.ts` re-emits EVERY lane in one pass, which is
 * the wrong blast radius for a single-lane hill-climb round: a runtime-template
 * change (RUNTIME_EMIT_REV) would rewrite five other lanes' committed
 * `examples/<lane>/figma/*.figma.js` in a round that never re-ran their
 * canvases, leaving their scripts ahead of their receipts. This script emits
 * ONLY `examples/altitude/figma/*.figma.js`, using exactly the same engine
 * configuration reemit-visual-fixes.ts uses for altitude (same token files,
 * same icon dir, same variable collection, same stem list), so the two agree
 * byte-for-byte on this lane.
 *
 *   npx tsx scripts/reemit-altitude-figma.ts
 */
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, sortByDependencies } from './contract-schema.js';
import { createFigmaEngine } from '../core/emit-figma-script.js';

const CONTRACTS_DIR = 'examples/altitude/contracts';
const OUT_DIR = 'examples/altitude/figma';
const TOKEN_FILES = [
  'examples/altitude/tokens/altitude.dtcg.json',
  'examples/altitude/tokens/altitude-minted.dtcg.json',
];
const ONLY = ['badge', 'chip', 'button', 'avatar', 'divider', 'heading', 'icon-close', 'link'];

const loadJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

function loadIcons(exampleDir: string): Map<string, string> {
  const iconsDir = path.join(exampleDir, 'assets', 'icons');
  const icons = new Map<string, string>();
  if (!existsSync(iconsDir)) return icons;
  for (const f of readdirSync(iconsDir)) {
    if (!f.endsWith('.svg')) continue;
    icons.set(f.replace(/\.svg$/, ''), readFileSync(path.join(iconsDir, f), 'utf8').trim());
  }
  return icons;
}

const [base, minted] = TOKEN_FILES;
const engine = createFigmaEngine({
  tokens: {
    primitives: loadJson(base),
    semantic: minted ? loadJson(minted) : {},
    light: {},
    dark: {},
    brands: { default: {} },
  },
  icons: loadIcons(path.dirname(CONTRACTS_DIR)),
  variableCollection: 'Altitude',
});

const contracts = readdirSync(CONTRACTS_DIR)
  .filter((f) => f.endsWith('.contract.json'))
  .map((f) => ContractSchema.parse(loadJson(path.join(CONTRACTS_DIR, f))));
const byId = new Map(contracts.map((c) => [c.id, c]));
mkdirSync(OUT_DIR, { recursive: true });

for (const c of sortByDependencies(contracts)) {
  if (c.figmaRepresentation === 'native') continue;
  const nameStem = c.name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
  const idStem = c.id.split('.').slice(1).join('-');
  const stem = ONLY.includes(nameStem) ? nameStem : ONLY.includes(idStem) ? idStem : null;
  if (!stem) continue;
  const script = engine.buildComponentScript(c, byId, undefined);
  writeFileSync(path.join(OUT_DIR, `${stem}.figma.js`), script);
  console.log('wrote', path.join(OUT_DIR, `${stem}.figma.js`));
}
