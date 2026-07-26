/**
 * Carbon dev-journey — Figma sync-script compile receipt.
 *   `node examples/carbon/scripts/figma-compile-receipt.mjs`
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
 * Writes examples/carbon/receipts/figma/COMPILE-RECEIPT.md; exits non-zero
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
    // CARBON: the mock lowers createNodeFromSvg to a plain FRAME (it renames to
    // the part name), so "is there a glyph on the canvas" cannot be read off the
    // node tree. Count the CALLS instead, and keep the payloads — that is the
    // falsifiable statement: an svg reached the API, with real geometry in it.
    const svgPayloads = [];
    const realCreateNodeFromSvg = mock.figma.createNodeFromSvg;
    mock.figma.createNodeFromSvg = (svg) => { svgPayloads.push(svg); return realCreateNodeFromSvg(svg); };
    const tok = await runScript(mock.figma, TOKENS_SCRIPT);
    if (!tok || typeof tok.total !== 'number') throw new Error('token sync returned no receipt');
    await runScript(mock.figma, src);
    // CARBON STRUCTURAL PINS — one per class of thing this round claims.
    // Each is a FALSIFIABLE statement about the built canvas, not a smoke test.
    if (name === 'button' || name === 'tag') {
      const want = name === 'button' ? 'Button' : 'Tag';
      const texts = mock.root.findAll((n) => n.type === 'TEXT' && n.characters === want);
      if (texts.length === 0) throw new Error(`${name} pin: no sample TEXT nodes carrying "${want}"`);
    }
    if (name === 'button') {
      // THE DEFAULTLESS-AXIS PIN. Carbon's `size` has no default, so the
      // capture leads the axis with the `unset` pseudo-value — and `unset`
      // is deliberately NOT a contract enum value, so the variant grid must
      // carry the six REAL sizes and no seventh "Unset" cell.
      const cells = mock.root.findAll((n) => n.type === 'COMPONENT' && /Size=/.test(n.name));
      if (cells.some((n) => /Size=Unset/i.test(n.name))) {
        throw new Error('button defaultless-axis pin: an "Unset" Size cell reached the canvas — the pseudo-value is a capture-side plane, never a variant');
      }
      for (const sz of ['Xs', 'Sm', 'Md', 'Lg', 'Xl', '2XL']) {
        if (!cells.some((n) => new RegExp(`Size=${sz}(,|$)`).test(n.name))) {
          throw new Error(`button defaultless-axis pin: no Size=${sz} cell (${[...new Set(cells.map((n) => /Size=([^,]*)/.exec(n.name)?.[1]))].join('|')})`);
        }
      }
      // …and the DANGER kinds must survive the `danger--primary` spelling
      // (a BEM modifier inside an enum value — the variant label splitter).
      if (!cells.some((n) => /Kind=Danger Primary/.test(n.name))) {
        throw new Error('button pin: no Kind=Danger Primary cell — the `danger--primary` enum value did not survive labelling');
      }
    }
    if (name === 'toggle' || name === 'checkbox') {
      // THE PROP-SELECTED-RENDERING PIN: `toggled` / `checked` are VARIANT
      // AXES, never stateProps (loadConfig refuses an out-of-vocabulary state
      // by name). Both planes must exist AND be orthogonal.
      const axis = name === 'toggle' ? 'Toggled' : 'Checked';
      const cells = (re) => mock.root.findAll((n) => n.type === 'COMPONENT' && re.test(n.name));
      const values = name === 'toggle' ? ['Untoggled', 'Toggled'] : ['Unchecked', 'Checked', 'Indeterminate'];
      const counts = values.map((v) => cells(new RegExp(`${axis}=${v}(,|$)`)).length);
      if (counts.some((c) => c === 0)) throw new Error(`${name} ${axis}-axis pin: missing plane(s) — ${values.map((v, i) => `${v}:${counts[i]}`).join(' ')}`);
      if (new Set(counts).size !== 1) throw new Error(`${name} ${axis}-axis pin: axis not orthogonal — ${values.map((v, i) => `${v}:${counts[i]}`).join(' ')}`);
    }
    if (name === 'modal') {
      // THE IN-PLACE-OVERLAY PIN. Carbon's Modal is NOT portalled: it renders
      // in place as a position:fixed full-bleed scrim, and the depth reader's
      // in-stage single-root branch is what must have picked it up. On canvas
      // that means a real frame carrying the heading text.
      const heads = mock.root.findAll((n) => n.type === 'TEXT' && n.characters === 'Modal heading');
      if (heads.length === 0) throw new Error('modal pin: no "Modal heading" TEXT node — the overlay root was not captured');
    }
    if (name === 'icon-button') {
      // THE $import PIN. The glyph came from a DIFFERENT PACKAGE
      // (@carbon/icons-react#Add) through the existing marker grammar — no new
      // engine vocabulary — was reconstructed by the svg-content promotion, and
      // is embedded in the emitted script. Assert it reached figma.createNodeFromSvg
      // with real geometry, once per variant cell.
      if (svgPayloads.length === 0) {
        throw new Error('icon-button $import pin: figma.createNodeFromSvg was never called — the {"$import":"@carbon/icons-react#Add"} glyph did not survive promotion into the emitted script');
      }
      const withPath = svgPayloads.filter((x) => /<path[^>]*\sd="[^"]{20,}"/.test(x));
      if (withPath.length === 0) {
        throw new Error(`icon-button $import pin: ${svgPayloads.length} svg payload(s) reached the canvas but none carries real <path d="..."> geometry — an empty glyph is not a glyph`);
      }
      if (svgPayloads.length !== got) {
        throw new Error(`icon-button $import pin: ${svgPayloads.length} glyph(s) for ${got} variant cells — every cell must carry the icon`);
      }
    }
    const set = mock.root.findAll((n) => n.type === 'COMPONENT_SET');
    rows.push(`| ${file} | ${contract.id} | ${axesLabel} | ${got} | tokens ${tok.total} (${tok.aliased} aliased) · ${set.length} set(s) built |`);
    totalVariants += got;
  } catch (e) {
    failures.push(`${file}: headless execute FAILED — ${e.message}`);
  }
}

const md = `# Carbon (@carbon/react) Figma sync — compile receipt

Generated by \`examples/carbon/scripts/figma-compile-receipt.mjs\`. Regenerate any time;
refuses (exit 1) on drift. Scripts under \`examples/carbon/figma/\` emitted by
\`ds-contracts figma examples/carbon/contracts --out examples/carbon/figma --tokens
examples/carbon/tokens/carbon.dtcg.json,examples/carbon/tokens/carbon-minted.dtcg.json\`.

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
console.log(`✔ compile receipt: ${scripts.length} scripts, ${totalVariants} variants, tokens+aliases executed headlessly — examples/carbon/receipts/figma/COMPILE-RECEIPT.md`);
