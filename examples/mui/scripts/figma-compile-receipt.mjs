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
      if (texts.length === 0) throw new Error('card pin: no "Card content" TEXT node — content binding missing');
      // LIVE-PASTE-3 PINS: the canonical CardContent composition — text sits
      // inside a 16px-padded content part on a 288px block-width card.
      const contents = mock.root.findAll((n) => n.name === 'label' && n.type === 'FRAME');
      const badPad = contents.find((f) => Math.round(f.paddingLeft) !== 16 || Math.round(f.paddingTop) !== 16);
      if (contents.length === 0 || badPad) throw new Error(`card pin: CardContent part missing 16px padding (found ${contents.length} parts${badPad ? `, pad ${badPad.paddingLeft}/${badPad.paddingTop}` : ''})`);
      const roots = mock.root.findAll((n) => n.type === 'COMPONENT' && /Elevation=/.test(n.name));
      const badW = roots.find((n) => Math.round(n.width) !== 288);
      if (badW) throw new Error(`card pin: block-root width expected 288, found ${Math.round(badW.width)}`);
      // LIVE-PASTE-4 PIN: block flow — the CardContent part spans the full
      // card width (left-aligned text), never centered as a hugging island.
      const narrow = contents.find((f) => Math.round(f.width) !== 288);
      if (narrow) throw new Error(`card pin: CardContent must span the 288 block width (left-aligned flow), found ${Math.round(narrow.width)}`);
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
      // LIVE-PASTE-2 PINS: round thumb (50% radius baked to px), hidden
      // input (clip-rect idiom carried as display:none — no white cover),
      // and CSS paint order (rail under track under thumb).
      const th = mock.root.findAll((n) => n.name === 'slider-thumb' && inMedium(n));
      const radOf = (n) => n.topLeftRadius ?? n.cornerRadius ?? 0;
      const badR = th.find((n) => Math.round(radOf(n)) !== 10);
      if (badR) throw new Error(`slider-thumb radius pin: expected 10, found ${radOf(badR)}`);
      for (const t of th) {
        const inputs = (t.children ?? []).filter((c) => c.visible !== false);
        const whiteCover = inputs.find((c) => (c.fills ?? []).some((f) => f.type === 'SOLID' && f.color && f.color.r > 0.99 && f.color.g > 0.99 && f.color.b > 0.99));
        if (whiteCover) throw new Error('slider hidden-input pin: a visible white-filled child covers the thumb');
      }
      for (const v2 of mock.root.findAll((n) => n.type === 'COMPONENT' && /Size=Medium/.test(n.name))) {
        const order = (v2.children ?? []).map((c) => c.name);
        const ir = order.indexOf('slider-rail'); const it = order.indexOf('slider-track'); const ith = order.indexOf('slider-thumb');
        if (ir < 0 || it < 0 || ith < 0) continue;
        if (!(ir < it && it < ith)) throw new Error(`slider paint-order pin: expected rail<track<thumb, got [${order.join(', ')}]`);
      }
    }
    if (name === 'switch') {
      geoPin('switch-track(medium)', mock.root.findAll((n) => n.name === 'switch-track' && inMedium(n)), 34, 14);
      geoPin('switch-thumb(medium)', mock.root.findAll((n) => n.name === 'switch-thumb' && inMedium(n)), 20, 20);
      // LIVE-PASTE-2 PINS: the absolute switchBase paints ABOVE the in-flow
      // track (CSS positioned-over-in-flow), the 300%-wide opacity-0 input
      // is carried hidden, and the thumb is a circle.
      for (const v2 of mock.root.findAll((n) => n.type === 'COMPONENT' && /Size=Medium/.test(n.name))) {
        const order = (v2.children ?? []).map((c) => c.name);
        const itr = order.indexOf('switch-track');
        const ibb = order.findIndex((nm) => /buttonbase/.test(nm));
        if (itr < 0 || ibb < 0) continue;
        if (!(itr < ibb)) throw new Error(`switch paint-order pin: track must precede the absolute switchBase, got [${order.join(', ')}]`);
      }
      const hiddenInputs = mock.root.findAll((n) => n.name === 'switch-input' && inMedium(n));
      const visibleInput = hiddenInputs.find((n) => n.visible !== false && !(n.opacity === 0));
      if (visibleInput) throw new Error('switch hidden-input pin: the opacity-0 input rendered visible');
      const th2 = mock.root.findAll((n) => n.name === 'switch-thumb' && inMedium(n));
      const radOf2 = (n) => n.topLeftRadius ?? n.cornerRadius ?? 0;
      const badR2 = th2.find((n) => Math.round(radOf2(n)) !== 10);
      if (badR2) throw new Error(`switch-thumb radius pin: expected 10, found ${radOf2(badR2)}`);
    }
    // MOLECULE-ROUND STRUCTURAL PINS (2026-07-25): one per interactive
    // component — the specific structure each contract exists to carry;
    // headless proof the class can never silently collapse.
    const textNode = (s) => mock.root.findAll((n) => n.type === 'TEXT' && n.characters === s);
    const partNamed = (nm) => mock.root.findAll((n) => n.name === nm);
    if (name === 'dialog') {
      // the modal pair: backdrop part + the paper carrying the content text
      if (partNamed('backdrop-root').length === 0) throw new Error('dialog pin: backdrop-root missing — the modal backdrop part collapsed');
      if (partNamed('dialog-paper').length === 0) throw new Error('dialog pin: dialog-paper missing');
      if (textNode('Dialog body copy for the molecule round.').length === 0) throw new Error('dialog pin: DialogContent text missing');
    }
    if (name === 'menu') {
      if (partNamed('menu-paper').length === 0) throw new Error('menu pin: menu-paper (Popover paper) missing');
      for (const item of ['Profile', 'My account', 'Log out']) {
        if (textNode(item).length === 0) throw new Error(`menu pin: MenuItem "${item}" missing`);
      }
    }
    if (name === 'tabs') {
      if (partNamed('tabs-indicator').length === 0) throw new Error('tabs pin: tabs-indicator (the selected-tab underline) missing');
      for (const t of ['Overview', 'Activity', 'Settings']) {
        if (textNode(t).length === 0) throw new Error(`tabs pin: Tab label "${t}" missing`);
      }
    }
    if (name === 'accordion') {
      if (partNamed('accordionsummary-gutters').length === 0) throw new Error('accordion pin: AccordionSummary button missing');
      if (textNode('Accordion title').length === 0) throw new Error('accordion pin: summary title text missing');
      if (textNode('Details body copy for the molecule round.').length === 0) throw new Error('accordion pin: AccordionDetails text missing');
    }
    if (name === 'autocomplete') {
      // chips + both end-adornment indicators; the OPEN listbox is a NAMED
      // residual (closed-state capture) — pinned absent deliberately, not
      // silently: this pin covers what the contract carries.
      for (const chip of ['Alpha', 'Beta']) {
        if (textNode(chip).length === 0) throw new Error(`autocomplete pin: chip "${chip}" missing`);
      }
      if (partNamed('autocomplete-clearindicator').length === 0) throw new Error('autocomplete pin: clear indicator missing');
      if (partNamed('autocomplete-popupindicator').length === 0) throw new Error('autocomplete pin: popup indicator missing');
    }
    if (name === 'tooltip') {
      // the positioned bubble: label text + arrow part
      if (textNode('Tooltip text').length === 0) throw new Error('tooltip pin: bubble text missing');
      if (partNamed('tooltip-arrow').length === 0) throw new Error('tooltip pin: tooltip-arrow part missing');
    }
    // ORGANISM-ROUND STRUCTURAL PINS (2026-07-25).
    if (name === 'checkbox') {
      // THREE glyphs, one per `checked` variant — the whole reason the
      // tri-state rides ONE axis (the svg promotion refuses multi-axis
      // markup by name and would have carried no glyph at all).
      for (const [variant, glyph] of [['Unchecked', 'icon-unchecked'], ['Checked', 'icon-checked'], ['Indeterminate', 'icon-indeterminate']]) {
        const v = mock.root.findAll((n) => n.type === 'COMPONENT' && n.name === `Checked=${variant}`);
        if (v.length !== 1) throw new Error(`checkbox pin: expected exactly one Checked=${variant} variant, found ${v.length}`);
        if (v[0].findAll((n) => n.name === glyph).length === 0) throw new Error(`checkbox pin: Checked=${variant} carries no "${glyph}" glyph part`);
      }
      // the opacity-0 full-cover input must never paint over the glyph
      const painted = mock.root.findAll((n) => /input/i.test(n.name) && n.visible !== false && (n.fills ?? []).some((f) => f.type === 'SOLID'));
      if (painted.length > 0) throw new Error(`checkbox pin: the sr-only input rendered as a painted node (${painted[0].name})`);
    }
    if (name === 'table-pagination') {
      // the toolbar in DOM ORDER — the select must sit BETWEEN its label and
      // the displayed-rows text (the position:relative partition used to
      // throw it to the end of the row).
      const toolbar = mock.root.findAll((n) => n.name === 'tablepagination-toolbar')[0];
      if (!toolbar) throw new Error('table-pagination pin: tablepagination-toolbar missing');
      const flat = (n) => [n, ...n.findAll()];
      const order = flat(toolbar).map((n) => n.characters ?? n.name);
      const at = (s) => order.findIndex((o) => o === s);
      for (const s of ['Rows per page:', '10', '1–3 of 3']) {
        if (at(s) < 0) throw new Error(`table-pagination pin: "${s}" missing from the toolbar (order: ${order.join(' | ')})`);
      }
      if (!(at('Rows per page:') < at('10') && at('10') < at('1–3 of 3'))) {
        throw new Error(`table-pagination pin: toolbar out of DOM order — expected label < select < displayedRows, got ${order.join(' | ')}`);
      }
      const actions = mock.root.findAll((n) => n.name === 'tablepagination-actions');
      if (actions.length === 0) throw new Error('table-pagination pin: tablepagination-actions missing');
      const buttons = actions[actions.length - 1].children ?? [];
      if (buttons.length !== 2) throw new Error(`table-pagination pin: expected 2 arrow buttons, found ${buttons.length}`);
    }
    if (name === 'table') {
      // THE ORGANISM PIN — the class no percentage can see: a table that is
      // not a table. Rows must be horizontal stacks, every column must carry
      // ONE width shared by header and body, every cell must carry the 1px
      // bottom divider (MUI puts the row rule on CELLS), the cells of a row
      // must be the SAME height (or the dividers step), and the selected row
      // must carry its own tint. Numbers are the REAL captured geometry at
      // the pinned 720×360/16 stage (688px content width).
      const COLUMNS = [52, 240.13, 132.97, 142.48, 120.42];
      const variants = mock.root.findAll((n) => n.type === 'COMPONENT' && /^Size=/.test(n.name));
      if (variants.length !== 2) throw new Error(`table pin: expected 2 Size variants, found ${variants.length}`);
      for (const variant of variants) {
        const rows = variant.findAll((n) => /^tablerow-/.test(n.name));
        if (rows.length !== 3) throw new Error(`table pin: ${variant.name} has ${rows.length} rows, expected 3 (1 head + 2 body)`);
        const grid = [];
        for (const row of rows) {
          if (row.layoutMode !== 'HORIZONTAL') {
            throw new Error(`table pin: row ${row.name} in ${variant.name} is ${row.layoutMode}, not HORIZONTAL — the table-row lowering collapsed`);
          }
          const cells = row.children ?? [];
          if (cells.length !== 5) throw new Error(`table pin: row ${row.name} in ${variant.name} has ${cells.length} cells, expected 5`);
          const noDivider = cells.find((c) => Math.round(c.strokeBottomWeight ?? 0) !== 1 || (c.strokes ?? []).length === 0);
          if (noDivider) throw new Error(`table pin: cell ${noDivider.name} in ${variant.name} carries no 1px bottom divider (the MUI row rule lives on cells)`);
          const heights = new Set(cells.map((c) => Math.round(c.height * 100) / 100));
          if (heights.size !== 1) throw new Error(`table pin: cells of ${row.name} in ${variant.name} have different heights {${[...heights].join(', ')}} — the dividers would step`);
          grid.push(cells.map((c) => Math.round(c.width * 100) / 100));
        }
        for (const [ri, widths] of grid.entries()) {
          for (let ci = 0; ci < COLUMNS.length; ci++) {
            if (Math.abs(widths[ci] - COLUMNS[ci]) > 0.5) {
              throw new Error(`table pin: ${variant.name} row ${ri} column ${ci} width ${widths[ci]} ≠ pinned ${COLUMNS[ci]} — the column algorithm's one-width-per-column fact is gone`);
            }
          }
        }
        // the selected body row carries its own fill; the plain one does not
        const selected = variant.findAll((n) => n.name === 'tablerow-root-2')[0];
        const plain = variant.findAll((n) => n.name === 'tablerow-root')[0];
        if (!selected || (selected.fills ?? []).length === 0) throw new Error(`table pin: ${variant.name} selected row carries no fill (the Mui-selected tint rides the TR, not the cells)`);
        if (plain && (plain.fills ?? []).length > 0) throw new Error(`table pin: ${variant.name} unselected row carries a fill — the selected tint is not row-specific`);
      }
      // the composed children: the head checkbox glyph, the sort arrow beside
      // "Name", and the right-aligned action control in every body row
      if (textNode('Name').length === 0) throw new Error('table pin: sort-label text "Name" missing');
      const sortLabel = mock.root.findAll((n) => n.name === 'label' && (n.children ?? []).length > 1);
      if (sortLabel.length === 0) throw new Error('table pin: the TableSortLabel part carries no arrow child (child-bearing text part dropped its children)');
      for (const s of ['Frozen yoghurt', 'Ice cream sandwich', 'Actions']) {
        if (textNode(s).length === 0) throw new Error(`table pin: cell text "${s}" missing`);
      }
      if (mock.root.findAll((n) => n.name === 'icon-2').length === 0) throw new Error('table pin: sort-label icon part missing');
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
\`ds-contracts figma examples/mui/contracts --out examples/mui/figma --icons
examples/mui/assets/icons --tokens
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
