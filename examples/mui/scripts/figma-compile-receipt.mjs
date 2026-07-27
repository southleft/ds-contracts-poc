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

      // STATE-PLANE PROJECTION PINS: `checked` is a real VARIANT AXIS now,
      // so the checked plane must be VISIBLE on canvas, not merely present
      // in the JSON. Before this round its colours minted as
      // `background-color-state-checked` — a channel no emitter rendered —
      // and the grid had no Checked axis at all.
      const variantsBy = (re) => mock.root.findAll((n) => n.type === 'COMPONENT' && re.test(n.name));
      const checkedVs = variantsBy(/Checked=Checked/);
      const uncheckedVs = variantsBy(/Checked=Unchecked/);
      if (checkedVs.length === 0 || uncheckedVs.length === 0) {
        throw new Error(`switch checked-axis pin: expected both Checked=Checked and Checked=Unchecked variants, found ${checkedVs.length}/${uncheckedVs.length}`);
      }
      if (checkedVs.length !== uncheckedVs.length) {
        throw new Error(`switch checked-axis pin: the Checked axis must be orthogonal (equal cells per value), got ${checkedVs.length} vs ${uncheckedVs.length}`);
      }
      // The TRACK carries a DIFFERENT bound fill variable per checked value
      // (MUI: black rail unchecked, palette colour checked) — the fact
      // examples/tailwind/PROVENANCE.md and this file both recorded as
      // "captured but projected by nobody".
      const trackFillVar = (variant) => {
        const tr = (variant.children ?? []).find((c) => c.name === 'switch-track');
        if (!tr) return null;
        const paint = (tr.fills ?? [])[0];
        return paint?.boundVariables?.color?.id ?? null;
      };
      const primaryChecked = checkedVs.find((n) => /Color=Primary/.test(n.name) && /Size=Medium/.test(n.name));
      const primaryUnchecked = uncheckedVs.find((n) => /Color=Primary/.test(n.name) && /Size=Medium/.test(n.name));
      if (!primaryChecked || !primaryUnchecked) throw new Error('switch checked-axis pin: Color=Primary/Size=Medium cells missing on both Checked values');
      const cFill = trackFillVar(primaryChecked);
      const uFill = trackFillVar(primaryUnchecked);
      if (!cFill || !uFill) throw new Error(`switch checked track-fill pin: the track must carry a BOUND fill variable on both checked planes (checked=${cFill}, unchecked=${uFill})`);
      if (cFill === uFill) throw new Error('switch checked track-fill pin: checked and unchecked tracks bind the SAME variable — the checked colour is not projected');
      // CLOSED RESIDUAL (pseudo-decor v2 + generalized translate door round):
      // the checked thumb now SITS WHERE MUI PUTS IT. MUI translates the
      // switchBase by matrix(1,0,0,1,20,0) at Size=Medium and (…,16,0) at
      // Size=Small; the v1 door only decomposed a matrix present on the BASE
      // combo and Switch's base is transform:none, so the offset was never
      // observed and both thumbs drew at the same x. The door now admits the
      // synthetic translate-x/y pair for any overlay-cluster part whose whole
      // enabled default plane is inside the translate grammar (ABSENT ≡ 0px),
      // so the offset mints per {size}×checked:
      //   translate-x.medium.unchecked 0px → .checked 20px
      //   translate-x.small.unchecked  0px → .checked 16px
      // This is now a POSITIVE pin: the displacement must equal the thumb
      // travel exactly, per size. See examples/mui/PROVENANCE.md.
      const thumbX = (variant) => {
        const bb = (variant.children ?? []).find((c) => /buttonbase/.test(c.name));
        if (!bb) throw new Error('switch thumb-position pin: no buttonbase part in the variant');
        const th = (bb.children ?? []).find((c) => c.name === 'switch-thumb');
        if (!th) throw new Error('switch thumb-position pin: no switch-thumb under the buttonbase part');
        return Math.round((bb.x ?? 0) + (th.x ?? 0));
      };
      const travelPins = [
        { size: 'Medium', travel: 20 },
        { size: 'Small', travel: 16 },
      ];
      for (const { size, travel } of travelPins) {
        const c = checkedVs.find((n) => /Color=Primary/.test(n.name) && new RegExp(`Size=${size}`).test(n.name));
        const u = uncheckedVs.find((n) => /Color=Primary/.test(n.name) && new RegExp(`Size=${size}`).test(n.name));
        if (!c || !u) throw new Error(`switch thumb-position pin: Color=Primary/Size=${size} cells missing on both Checked values`);
        const xc = thumbX(c);
        const xu = thumbX(u);
        if (xc - xu !== travel) {
          throw new Error(
            `switch thumb-position pin (Size=${size}): the checked thumb must sit exactly ${travel}px right of the unchecked thumb (MUI's translate for this size) — got x ${xu} → ${xc} (delta ${xc - xu}). The generalized translate door regressed.`,
          );
        }
      }
    }
    // MOLECULE-ROUND STRUCTURAL PINS (2026-07-25): one per interactive
    // component — the specific structure each contract exists to carry;
    // headless proof the class can never silently collapse.
    const textNode = (s) => mock.root.findAll((n) => n.type === 'TEXT' && n.characters === s);
    const partNamed = (nm) => mock.root.findAll((n) => n.name === nm);
    // MOLECULE LIVE-DEFECT ROUND (round 6, 2026-07-26) — LAYOUT-AWARE PINS.
    // The molecule pins below this block validated ANATOMY (a part exists, a
    // string reaches the canvas) and were all GREEN while the live paste
    // showed four broken components: the mock builds real node trees with
    // w/h/x/y and nobody was asserting on them. One layout pin per live
    // defect, each of which FAILS against the pre-round artifacts.
    const rootsOf = () => mock.root.findAll((n) => n.type === 'COMPONENT');
    // MUI REGEN ROUND (task #31) — D6b, AN ICON PART CAN ALSO BE A BOX.
    // The icon lowering used to compile a glyph-hosting part to a BARE svg
    // node sized by `icon.size`, throwing away the part's own box: its
    // background, its border, its padding, its control size. MUI's
    // Autocomplete indicators and TablePagination arrows are exactly that
    // shape — REAL BUTTONS (background + 1px border + padding) drawn on the
    // canvas as naked glyphs. The fix lowers a box-carrying icon part to
    // FRAME(box) → svg child. This pin asserts the BOX, not the glyph: a
    // regression to the bare-vector lowering fails by name.
    const iconButtonPin = (label, partName, w, h) => {
      const nodes = partNamed(partName);
      if (nodes.length === 0) throw new Error(`${label} pin: part "${partName}" missing`);
      for (const n of nodes) {
        const kid = (n.children ?? []).find((c) => c.name === `${partName}-icon`);
        if (!kid) {
          throw new Error(
            `${label} pin (D6b BARE GLYPH): "${partName}" has no "${partName}-icon" child — a box-carrying icon part must lower to FRAME(box) → svg child, not a bare vector (children: ${(n.children ?? []).map((c) => c.name).join(', ') || 'none'})`,
          );
        }
        if (Math.round(n.width) !== w || Math.round(n.height) !== h) {
          throw new Error(`${label} pin (D6b): "${partName}" control box is ${Math.round(n.width)}x${Math.round(n.height)}, expected ${w}x${h}`);
        }
        if (!(n.fills ?? []).length) throw new Error(`${label} pin (D6b): "${partName}" carries no fill — the button's own background was dropped`);
        if (!(n.paddingLeft > 0)) throw new Error(`${label} pin (D6b): "${partName}" reserves no padding around the glyph (padL=${n.paddingLeft})`);
      }
    };
    if (name === 'dialog') {
      // the modal pair: backdrop part + the paper carrying the content text
      if (partNamed('backdrop-root').length === 0) throw new Error('dialog pin: backdrop-root missing — the modal backdrop part collapsed');
      if (partNamed('dialog-paper').length === 0) throw new Error('dialog pin: dialog-paper missing');
      if (textNode('Dialog body copy for the molecule round.').length === 0) throw new Error('dialog pin: DialogContent text missing');
      // LIVE DEFECT 2 — the backdrop lowered as a SQUAT GREY BAND (full
      // width, a few px tall, the paper overlapping it) because an
      // out-of-flow child was sized against the parent box AS IT STOOD when
      // that child was appended, and Figma drops FILL sizing the moment a
      // node goes ABSOLUTE. Pin the scrim geometry per variant.
      for (const v of rootsOf()) {
        const kids = v.children ?? [];
        const bd = kids.find((c) => c.name === 'backdrop-root');
        if (!bd) throw new Error(`dialog pin: ${v.name} has no backdrop-root child`);
        if (kids.indexOf(bd) !== 0) throw new Error(`dialog pin: ${v.name} paints the backdrop at index ${kids.indexOf(bd)} — the scrim must be child 0 (BEHIND the paper)`);
        if (bd.layoutPositioning !== 'ABSOLUTE') throw new Error(`dialog pin: ${v.name} backdrop is in flow (${bd.layoutPositioning}) — the scrim is an inset-0 layer, not a row`);
        if (Math.round(bd.width) !== Math.round(v.width) || Math.round(bd.height) !== Math.round(v.height)) {
          throw new Error(
            `dialog pin (SQUAT BAND): ${v.name} backdrop is ${Math.round(bd.width)}x${Math.round(bd.height)} but the component is ${Math.round(v.width)}x${Math.round(v.height)} — the scrim must cover the whole cell`,
          );
        }
        // …and the paper must FIT the cell and be CENTERED in it. Wider
        // maxWidth variants baked 900/1200/1536px papers that hung off the
        // cell's left edge on the live canvas.
        const container = kids.find((c) => c.name === 'dialog-container');
        if (!container) throw new Error(`dialog pin: ${v.name} has no dialog-container`);
        if (container.primaryAxisAlignItems !== 'CENTER') throw new Error(`dialog pin: ${v.name} dialog-container justifies ${container.primaryAxisAlignItems}, not CENTER — the paper would not be centered`);
        const box = (container.children ?? [])[0];
        if (!box) throw new Error(`dialog pin: ${v.name} dialog-container is empty`);
        if (box.width > v.width + 0.5) {
          throw new Error(
            `dialog pin (PAPER OVERFLOW): ${v.name} paper box is ${Math.round(box.width)}px wide inside a ${Math.round(v.width)}px cell — a centered paper wider than its cell hangs off BOTH edges`,
          );
        }
        const paper = box.findAll((n) => n.name === 'dialog-paper')[0] ?? box;
        if (paper.maxWidth != null && paper.width > paper.maxWidth + 0.5) {
          throw new Error(`dialog pin: ${v.name} paper ${Math.round(paper.width)} exceeds its bound maxWidth ${paper.maxWidth}`);
        }
      }
      // the focus-trap sentinels are DOM plumbing, never canvas anatomy
      const sentinels = mock.root.findAll((n) => /^part-\d+$/.test(n.name));
      if (sentinels.length > 0) throw new Error(`dialog pin: ${sentinels.length} classless focus-trap sentinel part(s) reached the canvas (${sentinels.map((n) => n.name).join(', ')})`);
      // MUI REGEN ROUND (task #31) — D5, THE CAPTURE STAGE IS NOT A DESIGN
      // WIDTH. Dialog's root is a viewport-pinned full-bleed scrim, so the
      // computed floor measured its width as the CAPTURE VIEWPORT (900px,
      // examples/mui/PROVENANCE.md `viewport`) and the emitter baked that
      // number as the component's fixed width. Every Dialog cell drew 900px
      // wide — a number that exists nowhere in MUI. `boundFullBleedScrimRoot`
      // (core/emit-figma-script.ts) drops it; the root becomes a blockRoot
      // and the cell hugs its real content. Pinned at the number so a
      // regression to the stage size can never ship silently again.
      for (const v of rootsOf()) {
        const w = Math.round(v.width);
        if (w === 900) {
          throw new Error(`dialog pin (D5 CAPTURE STAGE): ${v.name} is ${w}px wide — that is the capture VIEWPORT width, not a MUI design width; the full-bleed scrim root must not carry it`);
        }
        if (w !== 496) throw new Error(`dialog pin (D5): ${v.name} is ${w}px wide, expected the content-hugged 496 (a moved number is a real change — re-review, then re-pin)`);
      }
    }
    if (name === 'menu') {
      for (const item of ['Profile', 'My account', 'Log out']) {
        if (textNode(item).length === 0) throw new Error(`menu pin: MenuItem "${item}" missing`);
      }
      // LIVE DEFECT 1 — the component was 900x1000 (the CAPTURE STAGE) with
      // the real ~115x124 paper in its top-left corner: the portal capture
      // carried MUI's full-bleed `position:fixed; inset:0` Popover LAYER as
      // the root. The PAPER is the component.
      const roots = rootsOf();
      if (roots.length !== 1) throw new Error(`menu pin: expected one standalone Menu component, found ${roots.length}`);
      const paper = roots[0];
      if (paper.width > 400 || paper.height > 400) {
        throw new Error(
          `menu pin (STAGE-SIZED ROOT): the Menu component is ${Math.round(paper.width)}x${Math.round(paper.height)} — that is the capture stage, not the Popover paper. The full-bleed scrim layer must be demoted and the paper promoted.`,
        );
      }
      if ((paper.fills ?? []).length === 0) throw new Error('menu pin: the Menu root carries no fill — the promoted root is not the paper');
      // …the invisible backdrop and the focus-trap sentinels are not anatomy
      for (const junk of ['backdrop-invisible', 'backdrop-root']) {
        if (partNamed(junk).length > 0) throw new Error(`menu pin: "${junk}" reached the canvas — an INVISIBLE MuiBackdrop is a scrim layer, not a Menu part`);
      }
      const sentinels = mock.root.findAll((n) => /^part-\d+$/.test(n.name));
      if (sentinels.length > 0) throw new Error(`menu pin: ${sentinels.length} classless focus-trap sentinel part(s) reached the canvas`);
      // LIVE DEFECT 1a — the items flowed HORIZONTALLY (ul.MuiList-root is
      // display:block and the block-flow lowering was root-only), so item 2
      // was clipped off the paper. They stack, and each spans the paper.
      const list = partNamed('list-padding')[0];
      if (!list) throw new Error('menu pin: list-padding (ul.MuiList-root) missing');
      if (list.layoutMode !== 'VERTICAL') {
        throw new Error(`menu pin (HORIZONTAL MENU): the MenuItem list lowered ${list.layoutMode} — a display:block list is CSS block flow and stacks its block-level children VERTICALLY`);
      }
      const items = (list.children ?? []).filter((c) => /^label(-\d+)?$/.test(c.name));
      if (items.length !== 3) throw new Error(`menu pin: expected 3 MenuItem rows under the list, found ${items.length}`);
      for (const it of items) {
        if (it.layoutSizingHorizontal !== 'FILL') throw new Error(`menu pin: MenuItem "${it.name}" does not span the paper (layoutSizingHorizontal=${it.layoutSizingHorizontal}) — a block-level list item fills its container`);
        if (Math.round(it.width) !== Math.round(paper.width)) throw new Error(`menu pin: MenuItem "${it.name}" is ${Math.round(it.width)} wide inside a ${Math.round(paper.width)} paper`);
      }
      // LIVE DEFECT 1c — MUI autofocuses the first MenuItem on open, so the
      // captured "default" plane of item 1 was really :focus-visible and the
      // grey tint baked into its BASE fill. Every item paints the same.
      const fillSig = (n) => JSON.stringify((n.fills ?? []).filter((f) => f.visible !== false));
      const sigs = new Set(items.map(fillSig));
      if (sigs.size !== 1) {
        throw new Error(
          `menu pin (AUTOFOCUS TINT): the three MenuItems carry ${sigs.size} different base fills — the autofocused first item's :focus-visible tint is baked into the default plane (${[...sigs].join(' vs ')})`,
        );
      }
    }
    if (name === 'tabs') {
      if (partNamed('tabs-indicator').length === 0) throw new Error('tabs pin: tabs-indicator (the selected-tab underline) missing');
      for (const t of ['Overview', 'Activity', 'Settings']) {
        if (textNode(t).length === 0) throw new Error(`tabs pin: Tab label "${t}" missing`);
      }
      // LIVE DEFECT 3 — only "Overview" reached the canvas and the indicator
      // rendered detached. Cause: MUI's Tab carries `max-width: 360px`, the
      // emitter baked a CEILING as a fixed WIDTH, and three 360px tabs
      // overflowed (and were clipped by) a 288px strip.
      for (const v of rootsOf()) {
        const list = v.findAll((n) => n.name === 'tabs-list')[0];
        if (!list) throw new Error(`tabs pin: ${v.name} has no tabs-list`);
        const labels = (list.children ?? []).filter((c) => /^label(-\d+)?$/.test(c.name));
        if (labels.length !== 3) throw new Error(`tabs pin: ${v.name} strip carries ${labels.length} Tab boxes, expected 3`);
        for (const l of labels) {
          if (l.width > list.width * 0.6) {
            throw new Error(
              `tabs pin (MAX-WIDTH AS WIDTH): ${v.name} Tab "${l.name}" is ${Math.round(l.width)} wide in a ${Math.round(list.width)} strip — a hugging tab cannot be more than half the strip; max-width is a CEILING, not a width`,
            );
          }
          if (l.layoutSizingHorizontal === 'FILL') {
            throw new Error(`tabs pin: ${v.name} Tab "${l.name}" FILLs the strip — align-items:stretch is a CROSS-axis fact and must not widen a flex ROW child`);
          }
        }
        // the indicator sits UNDER the active (first) tab, on the bottom edge
        const ind = v.findAll((n) => n.name === 'tabs-indicator')[0];
        if (!ind) throw new Error(`tabs pin: ${v.name} has no tabs-indicator`);
        if (ind.layoutPositioning !== 'ABSOLUTE') throw new Error(`tabs pin: ${v.name} indicator is in flow — it is an absolutely-positioned underline`);
        const parentH = ind.parent.height;
        if (Math.round(ind.y + ind.height) !== Math.round(parentH)) {
          throw new Error(`tabs pin (DETACHED INDICATOR): ${v.name} indicator bottom is ${Math.round(ind.y + ind.height)} but its container is ${Math.round(parentH)} tall — the underline must sit on the bottom edge`);
        }
        if (Math.round(ind.x) !== 0) throw new Error(`tabs pin: ${v.name} indicator starts at x=${Math.round(ind.x)} — tab 0 is selected, so it starts at the strip's left edge`);
        if (Math.abs(ind.width - labels[0].width) > 15) {
          throw new Error(`tabs pin: ${v.name} indicator is ${Math.round(ind.width)} wide but the active tab is ${Math.round(labels[0].width)} — the underline tracks the ACTIVE tab, not the strip`);
        }
      }
    }
    if (name === 'accordion') {
      if (partNamed('accordionsummary-gutters').length === 0) throw new Error('accordion pin: AccordionSummary button missing');
      if (textNode('Accordion title').length === 0) throw new Error('accordion pin: summary title text missing');
      if (textNode('Details body copy for the molecule round.').length === 0) throw new Error('accordion pin: AccordionDetails text missing');
      // LIVE DEFECT 5a — the summary title rendered CENTERED. MUI's content
      // span is flex-grow:1 inside a ButtonBase whose computed
      // justify-content is `center`; the bare-text lowering DROPPED grow, so
      // a hugging text node got centered by its parent.
      for (const v of rootsOf()) {
        const summary = v.findAll((n) => n.name === 'accordionsummary-gutters')[0];
        if (!summary) throw new Error(`accordion pin: ${v.name} has no AccordionSummary`);
        const title = summary.findAll((n) => n.characters === 'Accordion title')[0];
        if (!title) throw new Error(`accordion pin: ${v.name} summary carries no title text`);
        const spans = title.layoutSizingHorizontal === 'FILL' || Math.round(title.width) >= Math.round(summary.width - summary.paddingLeft - summary.paddingRight);
        if (!spans) {
          throw new Error(
            `accordion pin (CENTERED TITLE): ${v.name} summary title is ${Math.round(title.width)} wide inside a ${Math.round(summary.width)} row that justifies ${summary.primaryAxisAlignItems} — MUI's flex-grow:1 content span fills the row and left-aligns the text`,
          );
        }
        if (title.textAlignHorizontal !== 'LEFT') throw new Error(`accordion pin: ${v.name} summary title aligns ${title.textAlignHorizontal}, not LEFT`);
      }
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
      // MUI REGEN ROUND (D6b): both indicators are REAL BUTTONS — background,
      // 1px border, padding, a 28px control box — and drew as bare glyphs.
      iconButtonPin('autocomplete', 'autocomplete-clearindicator', 28, 28);
      iconButtonPin('autocomplete', 'autocomplete-popupindicator', 28, 28);
    }
    if (name === 'tooltip') {
      // the positioned bubble: label text + arrow part
      if (textNode('Tooltip text').length === 0) throw new Error('tooltip pin: bubble text missing');
      if (partNamed('tooltip-arrow').length === 0) throw new Error('tooltip pin: tooltip-arrow part missing');
      // LIVE DEFECT 4 — the bubble STRETCHED instead of hugging "Tooltip
      // text": MUI's tooltip carries `max-width: 300px` and the emitter
      // baked the ceiling as a fixed width. The bubble hugs BENEATH a real
      // Figma maxWidth ceiling.
      const bubble = partNamed('label').find((n) => n.type === 'FRAME');
      if (!bubble) throw new Error('tooltip pin: no bubble frame');
      const txt = bubble.findAll((n) => n.characters === 'Tooltip text')[0];
      if (!txt) throw new Error('tooltip pin: bubble carries no text node');
      const hugged = txt.width + bubble.paddingLeft + bubble.paddingRight;
      if (bubble.width > hugged + 24) {
        throw new Error(
          `tooltip pin (STRETCHED BUBBLE): the bubble is ${Math.round(bubble.width)} wide but its text + padding hug at ${Math.round(hugged)} — max-width is a CEILING, not a width`,
        );
      }
      if (bubble.maxWidth == null) throw new Error('tooltip pin: the 300px max-width ceiling is not bound as a Figma maxWidth — the fact was dropped, not lowered');
      // …and the `arrow` presence prop reaches the canvas as a real BOOLEAN
      // component property whose default HIDES the arrow (a presence axis is
      // a boolean property, never a variant plane — pinned so "the arrow
      // never materialised" can be answered by the receipt, not by a guess).
      const comp = rootsOf()[0];
      const defs = comp.componentPropertyDefinitions ?? {};
      const arrowKey = Object.keys(defs).find((k) => k.startsWith('Show Arrow#') || k === 'Show Arrow');
      if (!arrowKey) throw new Error(`tooltip pin: no "Show Arrow" component property (found: ${Object.keys(defs).join(', ') || 'none'})`);
      if (defs[arrowKey].type !== 'BOOLEAN' || defs[arrowKey].defaultValue !== false) {
        throw new Error(`tooltip pin: "Show Arrow" is ${defs[arrowKey].type} default ${defs[arrowKey].defaultValue}, expected BOOLEAN default false`);
      }
      const arrow = partNamed('tooltip-arrow')[0];
      if (arrow.componentPropertyReferences?.visible !== arrowKey) throw new Error('tooltip pin: the arrow node is not wired to the "Show Arrow" boolean');
      if (arrow.visible !== false) throw new Error('tooltip pin: the arrow is visible at the default (arrow=false) state');
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
      // MUI REGEN ROUND (D6b): the two arrows are 40px IconButtons, not glyphs.
      iconButtonPin('table-pagination', 'buttonbase-root', 40, 40);
      iconButtonPin('table-pagination', 'buttonbase-root-2', 40, 40);
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
