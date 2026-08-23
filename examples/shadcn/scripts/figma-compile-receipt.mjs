/**
 * shadcn dev-journey — Figma sync-script compile receipt.
 *   `node examples/shadcn/scripts/figma-compile-receipt.mjs`
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
 * Writes examples/shadcn/receipts/figma/COMPILE-RECEIPT.md; exits non-zero
 * (named) on any failure.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createFigmaMock } from '../../../scripts/plugin-engine-mock-figma.mjs';
import { countChildWider } from '../../../scripts/child-wider.mjs';
import { checkHugCeiling } from '../../../scripts/hug-ceiling-pin.mjs';

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
let totalTextOverflow = 0;

const scripts = readdirSync(FIGMA_DIR)
  .filter((f) => f.endsWith('.figma.js') && f !== '00-tokens.figma.js' && f !== 'GENESIS-BATCH.figma.js')
  .sort();

for (const file of scripts) {
  const name = file.replace('.figma.js', '');
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
  let textOverflowCount = 0;
  try {
    const mock = createFigmaMock();
    // the mock lowers createNodeFromSvg to a plain FRAME, so "is there a glyph
    // on the canvas" cannot be read off the node tree — count the CALLS.
    const svgPayloads = [];
    const realCreateNodeFromSvg = mock.figma.createNodeFromSvg;
    mock.figma.createNodeFromSvg = (svg) => { svgPayloads.push(svg); return realCreateNodeFromSvg(svg); };
    const tok = await runScript(mock.figma, TOKENS_SCRIPT);
    if (!tok || typeof tok.total !== 'number') throw new Error('token sync returned no receipt');
    await runScript(mock.figma, src);

    const allCells = mock.root.findAll((n) => n.type === 'COMPONENT' && n.parent?.type === 'COMPONENT_SET');
    const cellsOf = () => (allCells.length > 0 ? allCells : mock.root.findAll((n) => n.type === 'COMPONENT'));
    const descend = (n, out = []) => { out.push(n); for (const c of n.children ?? []) descend(c, out); return out; };
    const nodesOf = (n) => descend(n).slice(1);

    // SHADCN STRUCTURAL PINS — one per class of thing this round claims.
    if (name === 'button' || name === 'badge') {
      const want = name === 'button' ? 'Button' : 'Badge';
      const texts = mock.root.findAll((n) => n.type === 'TEXT' && n.characters === want);
      if (texts.length === 0) throw new Error(`${name} pin: no sample TEXT nodes carrying "${want}"`);
    }
    if (name === 'checkbox' || name === 'switch') {
      // THE PROP-SELECTED-RENDERING PIN (RECON H4): `checked` is a VARIANT
      // AXIS, never a stateProp. Every plane must exist AND be orthogonal.
      // bindings.figma.statePreviews adds State-axis preview cells on the DEFAULT plane
      // only, so the orthogonality claim is over the pure enum API grid:
      // cells with no State segment, or State=Default.
      const gridCell = (n) => n.type === 'COMPONENT' && (!/State=/.test(n.name) || /State=Default(,|$)/.test(n.name));
      const cells = (re) => mock.root.findAll((n) => gridCell(n) && re.test(n.name));
      const values = name === 'checkbox' ? ['Unchecked', 'Checked', 'Indeterminate'] : ['Unchecked', 'Checked'];
      const counts = values.map((v) => cells(new RegExp(`Checked=${v}(,|$)`)).length);
      if (counts.some((c) => c === 0)) throw new Error(`${name} Checked-axis pin: missing plane(s) — ${values.map((v, i) => `${v}:${counts[i]}`).join(' ')}`);
      if (new Set(counts).size !== 1) throw new Error(`${name} Checked-axis pin: axis not orthogonal — ${values.map((v, i) => `${v}:${counts[i]}`).join(' ')}`);
    }
    if (name === 'checkbox') {
      // THE TRI-STATE GLYPH PIN (RECON §5 prediction "full incl. tri-state
      // glyphs"): the lucide CheckIcon/MinusIcon rode the single-axis
      // svg-content promotion into the emitted script and reached
      // figma.createNodeFromSvg with real geometry.
      const withPath = svgPayloads.filter((x) => /<path[^>]*\sd="[^"]{10,}"/.test(x));
      if (withPath.length === 0) {
        throw new Error(`checkbox glyph pin: ${svgPayloads.length} svg payload(s) reached the canvas, none with real <path d="..."> geometry — the tri-state glyphs did not survive promotion`);
      }
    }
    if (name === 'dialog') {
      const heads = mock.root.findAll((n) => n.type === 'TEXT' && n.characters === 'Dialog title');
      if (heads.length === 0) throw new Error('dialog pin: no "Dialog title" TEXT node — the portaled content root was not captured');
      // D5 class: the cell must be the CONTENT, not the full-bleed overlay/stage.
      for (const cell of cellsOf()) {
        if (cell.height > 600 || cell.width > 900) {
          throw new Error(`dialog D5 pin: variant "${cell.name}" is ${Math.round(cell.width)}×${Math.round(cell.height)} — a viewport-pinned scrim's captured box is the CAPTURE STAGE, not the component`);
        }
      }
    }
    if (name === 'tooltip') {
      const tips = mock.root.findAll((n) => n.type === 'TEXT' && n.characters === 'Tooltip copy for the shadcn round.');
      if (tips.length === 0) throw new Error('tooltip pin: no tooltip-content TEXT node — the portaled bubble was not captured');
    }
    if (name === 'select') {
      // CLOSED-SURFACE pin: the round ships the closed trigger (placeholder
      // shown); the OPEN portaled list is a STOPPED capture (MULTI-ROOT
      // refusal — see extract/computed/configs/shadcn.json). An "Option 1"
      // TEXT node here would mean the claim drifted.
      const ph = mock.root.findAll((n) => n.type === 'TEXT' && n.characters === 'Select an option');
      if (ph.length === 0) throw new Error('select closed-surface pin: no "Select an option" placeholder TEXT node — the closed trigger was not captured');
      const items = mock.root.findAll((n) => n.type === 'TEXT' && n.characters === 'Option 1');
      if (items.length > 0) throw new Error('select closed-surface pin: an "Option 1" TEXT node reached the canvas — the open list is a STOPPED capture this round and must not appear');
    }
    // D3 — child-wider-than-parent is measured here and RATCHETED by the
    // shared two-sided baseline (scripts/child-wider.mjs + the
    // child-wider-ratchet eval), NOT hard-zeroed: that is the repo doctrine
    // for every library except Carbon (whose investigation landed). shadcn's
    // one real overflow is the tooltip arrow polygon — a NAMED svg-grammar
    // refusal (svg-child-outside-grammar: v1 carries path/g/circle; lucide's
    // arrow is a <polygon>), recorded in the committed baseline row.
    {
      const { textCaused } = countChildWider(mock.root);
      textOverflowCount = textCaused;
    }
    // D7 (task #37) — the HUG-CEILING pin (shared implementation).
    {
      const hugFailures = checkHugCeiling({ contract, entry, mockRoot: mock.root, name });
      if (hugFailures.length > 0) throw new Error(hugFailures.join(' | '));
    }
    const set = mock.root.findAll((n) => n.type === 'COMPONENT_SET');
    rows.push(`| ${file} | ${contract.id} | ${axesLabel} | ${got} | tokens ${tok.total} (${tok.aliased} aliased) · ${set.length} set(s) built | ${textOverflowCount} |`);
    totalTextOverflow += textOverflowCount;
    totalVariants += got;
  } catch (e) {
    failures.push(`${file}: headless execute FAILED — ${e.message}`);
  }
}

const md = `# shadcn Figma sync — compile receipt

Generated by \`examples/shadcn/scripts/figma-compile-receipt.mjs\`. Regenerate any time;
refuses (exit 1) on drift. Scripts under \`examples/shadcn/figma/\` emitted by
\`ds-contracts figma examples/shadcn/contracts --out examples/shadcn/figma --icons
examples/shadcn/assets/icons --tokens
examples/shadcn/tokens/shadcn.dtcg.json,examples/shadcn/tokens/shadcn-minted.dtcg.json\`.

| script | contract | variant axes | variants | headless execute | text-caused overflows |
|---|---|---|---|---|---|
${rows.join('\n')}

**${scripts.length} scripts · ${totalVariants} variants total · ${totalTextOverflow} text-caused
overflow(s) (the corpus-wide text-wrapping gap, counted not hidden).** Each script ran to
completion against the mocked Figma (00-tokens.figma.js first — ${TOKENS_SCRIPT.match(/(\d+) variables/)?.[1] ?? '?'} variables
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
console.log(`✔ compile receipt: ${scripts.length} scripts, ${totalVariants} variants, tokens+aliases executed headlessly — examples/shadcn/receipts/figma/COMPILE-RECEIPT.md`);
