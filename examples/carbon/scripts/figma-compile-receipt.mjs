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
import { countChildWider } from '../../../scripts/child-wider.mjs';

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
  let textOverflowCount = 0;
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
    // ---- LIVE-DEFECT ROUND PINS (the six defects the owner's real paste
    // found). Each one is the MEASUREMENT that was red before the fix, so a
    // regression cannot pass headlessly again. ----
    const allCells = mock.root.findAll((n) => n.type === 'COMPONENT' && n.parent?.type === 'COMPONENT_SET');
    const cellsOf = () => (allCells.length > 0 ? allCells : mock.root.findAll((n) => n.type === 'COMPONENT'));
    const descend = (n, out = []) => { out.push(n); for (const c of n.children ?? []) descend(c, out); return out; };
    const nodesOf = (n) => descend(n).slice(1);

    // D1 — SVG <title>/<desc> must never reach the canvas as visible ink.
    // Measured before the fix: InlineNotification drew the literal words
    // "error icon" beside the notification title, inside an `icon` FRAME
    // 173px wide (an icon frame carrying a text box).
    if (name === 'inline-notification') {
      const allowed = new Set(['Notification title', 'Notification subtitle']);
      const stray = cellsOf().flatMap((c) => nodesOf(c)).filter((n) => n.type === 'TEXT' && !allowed.has(n.characters));
      if (stray.length > 0) {
        throw new Error(`inline-notification D1 pin: ${stray.length} TEXT node(s) the component never authors reached the canvas (${[...new Set(stray.map((n) => JSON.stringify(n.characters)))].join(', ')}) — SVG <title>/<desc> is a11y METADATA, not canvas ink`);
      }
      for (const f of cellsOf().flatMap((c) => nodesOf(c)).filter((n) => n.name === 'icon' || n.name === 'icon-2')) {
        if (f.width > 24) throw new Error(`inline-notification D1 pin: "${f.name}" frame is ${Math.round(f.width)}px wide — an icon frame is a glyph box, never a text box`);
      }
    }
    // D2 — PSEUDO-ELEMENT ANATOMY. Carbon builds the checkbox box and the
    // toggle knob with ::before on the label; without them the components are
    // hollow (measured: the whole Checkbox was 288×20 of label, and
    // toggle__switch was a 48×24 track with ZERO children).
    if (name === 'checkbox') {
      const boxes = cellsOf().flatMap((c) => nodesOf(c)).filter((n) => n.name === 'checkbox-label-before');
      if (boxes.length === 0) throw new Error('checkbox D2 pin: no "checkbox-label-before" node — the ::before BOX is the whole visible checkbox and the canvas has none');
      for (const b of boxes) {
        if (Math.abs(b.width - 16) > 0.6 || Math.abs(b.height - 16) > 0.6) {
          throw new Error(`checkbox D2 pin: the box is ${Math.round(b.width)}×${Math.round(b.height)}, captured truth says 16×16`);
        }
      }
    }
    if (name === 'toggle') {
      const knobs = cellsOf().flatMap((c) => nodesOf(c)).filter((n) => n.name === 'toggle__switch-before');
      if (knobs.length === 0) throw new Error('toggle D2 pin: no "toggle__switch-before" node — the track draws and the knob does not');
      if (!knobs.some((k) => k.type === 'ELLIPSE')) {
        throw new Error(`toggle D2 pin: the knob is ${[...new Set(knobs.map((k) => k.type))].join('/')} — Carbon spells it \`border-radius: 50%\`; a percentage radius that folds to 0 ships a SQUARE knob`);
      }
    }
    // D3 — no in-flow child may be WIDER than its parent. A container whose
    // children overlap is never right. Measured before the fix: Accordion's
    // `accordion__wrapper` was 472/504px inside a 328px `accordion__item`
    // (display:list-item carried no layout), and `toggle__label` stacked the
    // label on top of the track (an inline box with block children).
    //
    // ONE EXEMPTION, COUNTED NOT HIDDEN: an overflow whose CAUSE is a hugging
    // TEXT descendant already wider than the parent is the corpus-wide TEXT
    // WRAPPING gap (docs/22 §"Text wrapping is not implemented" — MUI's
    // AccordionDetails body at 426px inside 288px is the same shape). Figma
    // text nodes here auto-size on one line, so the box hugs an unwrapped
    // run. That round changes every hugging text node in the corpus and is
    // not this one; the count is printed in the receipt table.
    // SILENT-LOSS ROUND (task #33): the measurement moved to
    // scripts/child-wider.mjs — ONE implementation, shared with the repo-wide
    // per-library RATCHET (`node scripts/child-wider.mjs`). Carbon keeps its
    // own HARD ZERO here because Carbon's investigation is the one that
    // already landed; the other libraries ratchet down from a committed
    // baseline instead of going red all at once.
    {
      const { overflows, textCaused, detail } = countChildWider(mock.root);
      textOverflowCount = textCaused;
      if (overflows > 0) {
        throw new Error(`${name} D3 pin: ${overflows} in-flow child(ren) wider than their parent, none of them text-caused — ${detail.slice(0, 3).join('; ')}`);
      }
    }
    // D5 — the Modal must not be a full-viewport dim rectangle. Measured
    // before the fix: 900×1000 per variant — the exact capture viewport.
    if (name === 'modal') {
      for (const cell of cellsOf()) {
        if (cell.height > 600 || cell.width > 900) {
          throw new Error(`modal D5 pin: variant "${cell.name}" is ${Math.round(cell.width)}×${Math.round(cell.height)} — a viewport-pinned scrim's captured box is the CAPTURE STAGE, not the component`);
        }
      }
    }
    // D6 — IconButton: no part that draws nothing, and the button keeps its
    // own box. Measured before the fix: a 24×24 ABSOLUTE `popover` frame that
    // paints nothing, and `btn` at 16×16 (the glyph) instead of the 24×24
    // control the contract sizes.
    if (name === 'icon-button') {
      const popovers = cellsOf().flatMap((c) => nodesOf(c)).filter((n) => n.name === 'popover');
      if (popovers.length > 0) throw new Error(`icon-button D6 pin: ${popovers.length} "popover" node(s) — an absolutely-positioned tooltip wrapper whose whole subtree is display:none draws NOTHING and is not anatomy`);
      const xs = cellsOf().filter((c) => /Size=Xs(,|$)/.test(c.name));
      for (const cell of xs) {
        const btn = descend(cell).find((n) => n.name === 'btn');
        if (!btn) throw new Error(`icon-button D6 pin: no "btn" node in ${cell.name}`);
        if (Math.abs(btn.width - 24) > 0.6 || Math.abs(btn.height - 24) > 0.6) {
          throw new Error(`icon-button D6 pin: "btn" is ${Math.round(btn.width)}×${Math.round(btn.height)} at Size=Xs — the contract sizes it 24×24; an icon-bearing part that loses its own box draws a bare glyph with no button chrome`);
        }
      }
    }
    const set = mock.root.findAll((n) => n.type === 'COMPONENT_SET');
    rows.push(`| ${file} | ${contract.id} | ${axesLabel} | ${got} | tokens ${tok.total} (${tok.aliased} aliased) · ${set.length} set(s) built | ${textOverflowCount} |`);
    totalTextOverflow += textOverflowCount;
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

| script | contract | variant axes | variants | headless execute | text-caused overflows |
|---|---|---|---|---|---|
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
