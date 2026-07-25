/**
 * MUI dev-journey — Figma sync-script compile receipt.
 *   `node examples/mui/scripts/figma-compile-receipt.mjs`
 *
 * The Astryx receipt pattern: each emitted script is proven two ways —
 *
 *   1. REFEREE — the emitted `const COMPONENTS = […]` payload parses and its
 *      set identity + variant-grid size match the contract's VARIANT-bound
 *      enum axes (computed FROM the contract, never hardcoded).
 *   2. HEADLESS EXECUTE — 00-tokens.figma.js then the component script run in
 *      a VM against the mocked `figma` global (scripts/plugin-engine-mock-
 *      figma.mjs) and must complete without throwing. The token sync's
 *      Figma-native ALIAS pass (source-aliased minted leaves) runs here too.
 *
 * Writes examples/mui/receipts/figma/COMPILE-RECEIPT.md; exits non-zero
 * (named) on any failure.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createFigmaMock } from '../../../scripts/plugin-engine-mock-figma.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(HERE, '..');
const FIGMA_DIR = path.join(EX, 'figma');

const parseComponents = (script) => JSON.parse(script.match(/const COMPONENTS = (\[[\s\S]*?\n\]);/)[1]);

const TOKENS_SCRIPT = readFileSync(path.join(FIGMA_DIR, '00-tokens.figma.js'), 'utf8');
async function runScript(figma, src) {
  const ctx = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  return await vm.runInContext(`(async () => {\n${src}\n})()`, ctx, { timeout: 120_000 });
}

const failures = [];
const rows = [];
let totalVariants = 0;

const scripts = readdirSync(FIGMA_DIR)
  .filter((f) => f.endsWith('.figma.js') && f !== '00-tokens.figma.js' && f !== 'GENESIS-BATCH.figma.js')
  .sort();

for (const file of scripts) {
  const name = file.replace('.figma.js', '');
  const contract = JSON.parse(readFileSync(path.join(EX, 'contracts', `${name}.contract.json`), 'utf8'));
  const variantAxes = (contract.props ?? []).filter((p) => p.bindings?.figma?.kind === 'VARIANT' && p.type?.enum);
  const expectedVariants = variantAxes.reduce((n, p) => n * p.type.enum.length, 1);
  const axesLabel = variantAxes.length ? variantAxes.map((p) => `${p.name}(${p.type.enum.length})`).join('×') : 'standalone';

  const src = readFileSync(path.join(FIGMA_DIR, file), 'utf8');
  let payload;
  try {
    payload = parseComponents(src);
  } catch (e) {
    failures.push(`${file}: COMPONENTS payload does not parse — ${e.message}`);
    continue;
  }
  const entry = payload.find((c) => c.contractId === contract.id);
  if (!entry) {
    failures.push(`${file}: payload has no component with contractId ${contract.id} (ids: ${payload.map((c) => c.contractId).join(', ')})`);
    continue;
  }
  const got = entry.variants?.length ?? 1;
  if (got !== expectedVariants) {
    failures.push(`${file}: variant grid ${got} ≠ contract axes product ${expectedVariants} (${axesLabel})`);
  }

  // headless execute: fresh mock file, tokens first, then the component sync
  try {
    const mock = createFigmaMock();
    const tok = await runScript(mock.figma, TOKENS_SCRIPT);
    if (!tok || typeof tok.total !== 'number') throw new Error('token sync returned no receipt');
    await runScript(mock.figma, src);
    // LIVE-CANVAS PINS (2026-07-25 review): the two classes the first live
    // paste exposed that no gate caught — box-padded text lowering (Chip's
    // label span owns the pill's 12px side padding; a TEXT node can't carry
    // it) and root direct-text content (Card renders children as a bare text
    // node). Pinned here so they can never pass silently again.
    if (name === 'chip') {
      const labels = mock.root.findAll((n) => n.name === 'label' && n.type === 'FRAME');
      if (labels.length === 0) throw new Error('chip pin: no label FRAME — box-padded text lowering missing');
      const bad = labels.find((f) => f.paddingLeft !== 12 || f.paddingRight !== 12 || !(f.children ?? []).some((c) => c.type === 'TEXT'));
      if (bad) throw new Error(`chip pin: label frame missing 12px side padding or TEXT child (padL=${bad.paddingLeft}, padR=${bad.paddingRight})`);
    }
    if (name === 'card') {
      const texts = mock.root.findAll((n) => n.type === 'TEXT' && n.characters === 'Card content');
      if (texts.length === 0) throw new Error('card pin: no "Card content" TEXT node — root content binding missing');
    }
    // GEOMETRY PINS (absolute-positioning round): the class the fidelity
    // gate is structurally blind to (geometry is excluded from computed
    // comparison) — pinned here at the REAL MUI default-theme numbers so
    // overlay-anatomy collapse can never pass headlessly again.
    const geoPin = (label, nodes, w, h) => {
      if (nodes.length === 0) throw new Error(`${label} pin: no nodes found`);
      const bad = nodes.find((n) => Math.round(n.width) !== w || Math.round(n.height) !== h);
      if (bad) throw new Error(`${label} pin: expected ${w}x${h}, found ${Math.round(bad.width)}x${Math.round(bad.height)}`);
    };
    const inMedium = (n) => {
      for (let a = n.parent; a; a = a.parent) if (a.type === 'COMPONENT' && /Size=Medium/.test(a.name)) return true;
      return false;
    };
    if (name === 'slider') {
      geoPin('slider-thumb(medium)', mock.root.findAll((n) => n.name === 'slider-thumb' && inMedium(n)), 20, 20);
      const rails = mock.root.findAll((n) => n.name === 'slider-rail' && inMedium(n));
      if (rails.length === 0) throw new Error('slider-rail pin: no nodes');
      const badRail = rails.find((n) => Math.round(n.height) !== 4 || n.width < 100);
      if (badRail) throw new Error(`slider-rail pin: expected h=4/stretched, found ${Math.round(badRail.width)}x${Math.round(badRail.height)}`);
    }
    if (name === 'switch') {
      geoPin('switch-track(medium)', mock.root.findAll((n) => n.name === 'switch-track' && inMedium(n)), 34, 14);
      geoPin('switch-thumb(medium)', mock.root.findAll((n) => n.name === 'switch-thumb' && inMedium(n)), 20, 20);
    }
    const set = mock.root.findAll((n) => n.type === 'COMPONENT_SET');
    rows.push(`| ${file} | ${contract.id} | ${axesLabel} | ${got} | tokens ${tok.total} (${tok.aliased} aliased) · ${set.length} set(s) built |`);
    totalVariants += got;
  } catch (e) {
    failures.push(`${file}: headless execute FAILED — ${e.message}`);
  }
}

const md = `# MUI Figma sync — compile receipt

Generated by \`examples/mui/scripts/figma-compile-receipt.mjs\`. Regenerate any time;
refuses (exit 1) on drift. Scripts under \`examples/mui/figma/\` emitted by
\`ds-contracts figma examples/mui/contracts --out examples/mui/figma --tokens
examples/mui/tokens/mui.dtcg.json,examples/mui/tokens/mui-minted.dtcg.json\`.

| script | contract | variant axes | variants | headless execute |
|---|---|---|---|---|
${rows.join('\n')}

**${scripts.length} scripts · ${totalVariants} variants total.** Each script ran to completion
against the mocked Figma (00-tokens.figma.js first — ${TOKENS_SCRIPT.match(/(\d+) variables/)?.[1] ?? '?'} variables
including the Figma-native ALIAS pass for source-aliased minted leaves).

${failures.length === 0 ? '**0 failures.**' : `## FAILURES (${failures.length})\n\n${failures.map((f) => `- ${f}`).join('\n')}`}
`;

mkdirSync(path.join(EX, 'receipts', 'figma'), { recursive: true });
writeFileSync(path.join(EX, 'receipts', 'figma', 'COMPILE-RECEIPT.md'), md);
if (failures.length > 0) {
  console.error(`✘ compile receipt: ${failures.length} failure(s)`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`✔ compile receipt: ${scripts.length} scripts, ${totalVariants} variants, tokens+aliases executed headlessly — examples/mui/receipts/figma/COMPILE-RECEIPT.md`);
