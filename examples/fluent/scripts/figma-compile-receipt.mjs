/**
 * Fluent 2 dev-journey — Figma sync-script compile receipt.
 *   `node examples/fluent/scripts/figma-compile-receipt.mjs`
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
 * Contracts are resolved by `contractId` out of a map built from
 * examples/fluent/contracts/, not by transforming the script filename: Fluent
 * has two multi-word components (MessageBar, TabList) whose capture out-dir,
 * seed filename and emitted script name do not agree on where the word
 * boundary goes, and a filename transform is exactly the kind of guess that
 * turns into a silent mismatch.
 *
 * Writes examples/fluent/receipts/figma/COMPILE-RECEIPT.md; exits non-zero
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
const CONTRACTS_DIR = path.join(EX, 'contracts');

const parseComponents = (script) => JSON.parse(script.match(/const COMPONENTS = (\[[\s\S]*?\n\]);/)[1]);

const BY_ID = new Map();
for (const f of readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith('.contract.json'))) {
  const c = JSON.parse(readFileSync(path.join(CONTRACTS_DIR, f), 'utf8'));
  BY_ID.set(c.id, c);
}

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
  const src = readFileSync(path.join(FIGMA_DIR, file), 'utf8');
  let payload;
  try {
    payload = parseComponents(src);
  } catch (e) {
    failures.push(`${file}: COMPONENTS payload does not parse — ${e.message}`);
    continue;
  }
  const entry = payload[0];
  const contract = BY_ID.get(entry?.contractId);
  if (!contract) {
    failures.push(`${file}: payload contractId ${entry?.contractId} matches no contract in examples/fluent/contracts/ (ids: ${[...BY_ID.keys()].join(', ')})`);
    continue;
  }
  const variantAxes = (contract.props ?? []).filter((p) => p.bindings?.figma?.kind === 'VARIANT' && p.type?.enum);
  const expectedVariants = variantAxes.reduce((n, p) => n * p.type.enum.length, 1);
  const axesLabel = variantAxes.length ? variantAxes.map((p) => `${p.name}(${p.type.enum.length})`).join('×') : 'standalone';

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
    const textIs = (s) => mock.root.findAll((n) => n.type === 'TEXT' && n.characters === s);

    // FLUENT STRUCTURAL PINS — one per class of thing this round claims.
    if (name.startsWith('button')) {
      if (textIs('Button').length === 0) throw new Error('button pin: no sample TEXT node carrying "Button"');
    }
    if (name.startsWith('badge')) {
      if (textIs('9').length === 0) throw new Error('badge pin: no sample TEXT node carrying "9"');
    }
    if (name.startsWith('avatar')) {
      // Fluent computes initials deterministically from name="Fluent Two".
      // A missing "FT" means the initials slot did not promote — which is the
      // whole Avatar capture, since the image slot is refused by name.
      if (textIs('FT').length === 0) throw new Error('avatar initials pin: no "FT" TEXT node — initials are computed from name="Fluent Two" and are the only rendered content this round captures');
    }
    if (name.startsWith('checkbox') || name.startsWith('switch')) {
      // THE PROP-SELECTED-RENDERING PIN: `checked` is a VARIANT AXIS, never a
      // stateProp. Every plane must exist AND be orthogonal. bindings.figma.statePreviews
      // adds State-axis preview cells on the DEFAULT plane only, so the
      // orthogonality claim is over the pure enum API grid.
      const gridCell = (n) => n.type === 'COMPONENT' && (!/State=/.test(n.name) || /State=Default(,|$)/.test(n.name));
      const cells = (re) => mock.root.findAll((n) => gridCell(n) && re.test(n.name));
      const values = name.startsWith('checkbox') ? ['Unchecked', 'Checked', 'Mixed'] : ['Unchecked', 'Checked'];
      const counts = values.map((v) => cells(new RegExp(`Checked=${v}(,|$)`)).length);
      if (counts.some((c) => c === 0)) throw new Error(`${name} Checked-axis pin: missing plane(s) — ${values.map((v, i) => `${v}:${counts[i]}`).join(' ')}`);
      if (new Set(counts).size !== 1) throw new Error(`${name} Checked-axis pin: axis not orthogonal — ${values.map((v, i) => `${v}:${counts[i]}`).join(' ')}`);
    }
    if (name.startsWith('checkbox')) {
      // THE TRI-STATE GLYPH PIN, INVERTED BY MEASUREMENT. RECON §5 predicted
      // "the tri-state glyphs should promote (one-axis discipline)" and the
      // config honoured that discipline exactly — `checked` is ONE axis, the
      // axisValueMap maps unchecked/checked/mixed to false/true/"mixed". It
      // was still not enough, and the reason is a fact about Fluent rather
      // than about the config: the glyph's viewBox is a function of `size`
      // too (12×12 at medium, 16×16 at large — see the svg-viewbox-
      // reconstructed receipts), so the markup varies over TWO axes and the
      // promotion refuses BY NAME:
      //   svg-content-multi-axis: Checkbox.indicator — markup varies over
      //   more than one axis; asset refused (part still promoted as a box)
      // The single-axis rule is therefore UNSATISFIABLE BY CONFIG here: the
      // only way to earn the glyph is to pin `size`, i.e. to give up a real
      // variant axis for an icon. This pin asserts the refusal is present and
      // NAMED — the honest claim — instead of asserting a promotion this
      // library cannot produce. If a future round makes the glyph survive two
      // axes, this pin fails and gets rewritten in that round's terms.
      const ext = JSON.parse(readFileSync(path.join(EX, 'contracts', 'checkbox.extension.json'), 'utf8'));
      if (!JSON.stringify(ext).includes('svg-content-multi-axis')) {
        throw new Error('checkbox glyph pin: expected a NAMED svg-content-multi-axis refusal on Checkbox.indicator (the glyph varies over checked AND size); it is absent — either the glyph now promotes (good, rewrite this pin) or the refusal stopped being receipted (bad)');
      }
    }
    if (name.startsWith('message-bar') || name.startsWith('messagebar')) {
      if (textIs('Message title').length === 0) throw new Error('message-bar pin: no "Message title" TEXT node — the MessageBarBody ⊃ MessageBarTitle composition did not promote');
    }
    if (name.startsWith('tab-list') || name.startsWith('tablist')) {
      if (textIs('Overview').length === 0) throw new Error('tab-list pin: no "Overview" TEXT node — the 2×Tab childrenSpec did not promote');
    }
    if (name.startsWith('spinner')) {
      if (textIs('Loading').length === 0) throw new Error('spinner pin: no "Loading" TEXT node — the label slot did not promote');
    }
    if (name.startsWith('tooltip')) {
      // THE ROOT-LITERAL-TEXT GAP, PINNED AS THE RESIDUAL IT IS. The bubble's
      // copy IS captured and IS carried — the promotion receipts
      //   root-literal-text-carried: root direct text "Tooltip copy for the
      //   Fluent ro…" matches no prop sample — carried verbatim (named)
      // and the contract holds it at `anatomy.root.text`. It then reaches NO
      // canvas node, because core/emit-figma-script.ts renders `text` on
      // PARTS only and never reads the ROOT's. Fluent's Tooltip is the ONLY
      // contract in the whole corpus carrying anatomy.root.text (measured
      // across every examples/*/contracts/*.contract.json), which is why no
      // previous round could have found it: every other component's literal
      // text either matches a prop sample and becomes `content`, or sits on a
      // child part. Fixing it is a canvas-grammar decision (where a root's own
      // text becomes a child node, and how it interacts with auto-layout), so
      // this round NAMES it rather than guessing. The pin asserts the gap is
      // exactly where it is believed to be: carried in the contract, absent
      // from the canvas. When the emitter learns to draw it, this fails loudly.
      // ROOT-TEXT PIN RETIRED (rejected-sets round): the pin above used to
      // assert the bubble copy NEVER reached the canvas (the anatomy.root.text
      // emitter residual). The re-promotion of this round closed the gap —
      // the emitted set now draws the bubble copy as canvas text — so the pin
      // is deleted per its own instruction and the closure is recorded here:
      // fluent.tooltip's root text ships on the canvas surface as of this
      // round; the E2 wrapper pins below still hold.
      // THE E2 PIN — this round's engine change, asserted on the canvas.
      // Before E2, Fluent's Tooltip captured the FluentProvider portal
      // wrapper: a 900×0 box that declares an opaque fill, draws no ink, and
      // cannot be screenshotted (four `locator.screenshot: Timeout` receipts
      // in the pre-fix run). A zero-area or stage-sized cell here means the
      // wrapper came back as the captured root.
      for (const cell of cellsOf()) {
        if (cell.width === 0 || cell.height === 0) {
          throw new Error(`tooltip E2 pin: variant "${cell.name}" is ${cell.width}×${cell.height} — a ZERO-AREA cell is the FluentProvider portal wrapper, not the bubble`);
        }
        if (cell.width > 400 || cell.height > 200) {
          throw new Error(`tooltip E2 pin: variant "${cell.name}" is ${Math.round(cell.width)}×${Math.round(cell.height)} — too large to be the tooltip bubble; the captured root is a wrapper or the stage`);
        }
      }
    }
    // D3 — child-wider-than-parent is measured here and RATCHETED by the
    // shared two-sided baseline (scripts/child-wider.mjs + the
    // child-wider-ratchet eval), NOT hard-zeroed: that is the repo doctrine
    // for every library except Carbon (whose investigation landed).
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

const md = `# Fluent 2 Figma sync — compile receipt

Generated by \`examples/fluent/scripts/figma-compile-receipt.mjs\`. Regenerate any time;
refuses (exit 1) on drift. Scripts under \`examples/fluent/figma/\` emitted by
\`ds-contracts figma examples/fluent/contracts --out examples/fluent/figma --icons
examples/fluent/assets/icons --tokens
examples/fluent/tokens/fluent.dtcg.json,examples/fluent/tokens/fluent-minted.dtcg.json\`.

Subject: \`@fluentui/react-components@9.74.5\` (Griffel CSS-in-JS), captured through the
\`<FluentProvider theme={webLightTheme}>\` mount — all 459 theme custom properties are
declared on that wrapper div, never on \`:root\` (RECON §2.3).

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
console.log(`✔ compile receipt: ${scripts.length} scripts, ${totalVariants} variants, tokens+aliases executed headlessly — examples/fluent/receipts/figma/COMPILE-RECEIPT.md`);
