/**
 * Tailwind dev-journey — Figma sync-script compile receipt.
 *   `node examples/tailwind/scripts/figma-compile-receipt.mjs`
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
 * Writes examples/tailwind/receipts/figma/COMPILE-RECEIPT.md; exits non-zero
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
  // emitted script names are kebab-case (ToggleSwitch → toggle-switch); the
  // promoted contract files use the flat lowercase component name.
  const contract = JSON.parse(readFileSync(path.join(EX, 'contracts', `${name.replace(/-/g, '')}.contract.json`), 'utf8'));
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
    // TAILWIND PINS: text present on Button/Badge/Alert; the toggle draws a
    // real track box (the round-thumb ::after pseudo rides pseudoDecor).
    if (name === 'button' || name === 'badge') {
      const texts = mock.root.findAll((n) => n.type === 'TEXT' && n.characters === (name === 'button' ? 'Button' : 'Badge'));
      if (texts.length === 0) throw new Error(`${name} pin: no sample TEXT nodes`);
    }
    if (name === 'toggle-switch') {
      const tracks = mock.root.findAll((n) => n.type === 'FRAME' && n.topLeftRadius > 6 && n.width > 20 && n.width < 80);
      if (tracks.length === 0) throw new Error('toggle pin: no rounded track frames found');
      // STATE-PLANE PROJECTION PINS: `checked` is a VARIANT AXIS now, so the
      // canvas carries a Checked cell whose TRACK binds a different fill
      // variable. Before this round the delta minted as
      // `background-color-state-checked` — captured, minted, rendered by
      // NOBODY (examples/tailwind/PROVENANCE.md named it).
      const cells = (re) => mock.root.findAll((n) => n.type === 'COMPONENT' && re.test(n.name));
      const on = cells(/Checked=Checked/);
      const off = cells(/Checked=Unchecked/);
      if (on.length === 0 || off.length === 0) throw new Error(`toggle checked-axis pin: expected both Checked values, found ${on.length}/${off.length}`);
      if (on.length !== off.length) throw new Error(`toggle checked-axis pin: axis not orthogonal (${on.length} vs ${off.length})`);
      const trackFillVar = (variant) => {
        const tr = (variant.children ?? []).find((c) => c.type === 'FRAME');
        if (!tr) throw new Error('toggle checked track-fill pin: no track frame in the variant');
        return ((tr.fills ?? [])[0]?.boundVariables?.color?.id) ?? null;
      };
      const md = (list) => list.find((n) => /Sizing=Md/.test(n.name));
      const onMd = md(on); const offMd = md(off);
      if (!onMd || !offMd) throw new Error('toggle checked-axis pin: Sizing=Md cells missing on both Checked values');
      const f1 = trackFillVar(onMd); const f0 = trackFillVar(offMd);
      if (!f1 || !f0) throw new Error(`toggle checked track-fill pin: the track must carry a BOUND fill variable on both planes (checked=${f1}, unchecked=${f0})`);
      if (f1 === f0) throw new Error('toggle checked track-fill pin: both planes bind the SAME variable — the checked track colour is not projected');
    }
    const set = mock.root.findAll((n) => n.type === 'COMPONENT_SET');
    rows.push(`| ${file} | ${contract.id} | ${axesLabel} | ${got} | tokens ${tok.total} (${tok.aliased} aliased) · ${set.length} set(s) built |`);
    totalVariants += got;
  } catch (e) {
    failures.push(`${file}: headless execute FAILED — ${e.message}`);
  }
}

const md = `# Tailwind (Flowbite React) Figma sync — compile receipt

Generated by \`examples/tailwind/scripts/figma-compile-receipt.mjs\`. Regenerate any time;
refuses (exit 1) on drift. Scripts under \`examples/tailwind/figma/\` emitted by
\`ds-contracts figma examples/tailwind/contracts --out examples/tailwind/figma --tokens
examples/mui/tokens/tailwind.dtcg.json,examples/tailwind/tokens/tailwind-minted.dtcg.json\`.

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
console.log(`✔ compile receipt: ${scripts.length} scripts, ${totalVariants} variants, tokens+aliases executed headlessly — examples/tailwind/receipts/figma/COMPILE-RECEIPT.md`);
