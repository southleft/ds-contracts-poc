/**
 * Altitude dev-journey — Figma sync-script compile receipt.
 *   `node examples/altitude/scripts/figma-compile-receipt.mjs`
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
 * Writes examples/altitude/receipts/figma/COMPILE-RECEIPT.md; exits non-zero
 * (named) on any failure.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createFigmaMock } from '../../../scripts/plugin-engine-mock-figma.mjs';
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
    // ALTITUDE: the mock lowers createNodeFromSvg to a plain FRAME (it renames to
    // the part name), so "is there a glyph on the canvas" cannot be read off the
    // node tree. Count the CALLS instead, and keep the payloads — that is the
    // falsifiable statement: an svg reached the API, with real geometry in it.
    const svgPayloads = [];
    const realCreateNodeFromSvg = mock.figma.createNodeFromSvg;
    mock.figma.createNodeFromSvg = (svg) => { svgPayloads.push(svg); return realCreateNodeFromSvg(svg); };
    const tok = await runScript(mock.figma, TOKENS_SCRIPT);
    if (!tok || typeof tok.total !== 'number') throw new Error('token sync returned no receipt');
    await runScript(mock.figma, src);
    // ALTITUDE STRUCTURAL PINS — one per class of thing THIS round claims.
    // Each is a FALSIFIABLE statement about the built canvas, not a smoke test.
    if (name === 'button' || name === 'chip' || name === 'link' || name === 'badge' || name === 'heading') {
      const want = { button: 'Button', chip: 'Chip', link: 'Link', badge: 'Badge', heading: 'Heading' }[name];
      const texts = mock.root.findAll((n) => n.type === 'TEXT' && n.characters === want);
      if (texts.length === 0) {
        throw new Error(`${name} SLOTTED-TEXT pin: no sample TEXT node carrying "${want}" — the text lives in the LIGHT DOM and reaches the render only through a <slot> inside the shadow root; a reader that walked shadow children without resolving assignedNodes() would produce exactly this empty canvas`);
      }
    }
    if (name === 'button') {
      // THE DEFAULTLESS-AXIS PIN, at full width. EVERY enum in Altitude is
      // defaultless — there is no `variant="primary"`, primary IS the absence
      // of the attribute — so the capture leads every axis with the `unset`
      // pseudo-value. `unset` is deliberately NOT a contract enum value, so
      // the grid must carry the four REAL variants and no fifth "Unset" cell.
      const cells = mock.root.findAll((n) => n.type === 'COMPONENT' && /Variant=/.test(n.name));
      if (cells.some((n) => /Variant=Unset/i.test(n.name))) {
        throw new Error('button defaultless-axis pin: an "Unset" Variant cell reached the canvas — the pseudo-value is a capture-side plane, never a variant');
      }
      for (const v of ['Secondary', 'Tertiary', 'Bare', 'Danger']) {
        if (!cells.some((n) => new RegExp(`Variant=${v}(,|$)`).test(n.name))) {
          throw new Error(`button defaultless-axis pin: no Variant=${v} cell (${[...new Set(cells.map((n) => /Variant=([^,]*)/.exec(n.name)?.[1]))].join('|')})`);
        }
      }
    }
    if (name === 'avatar') {
      // THE DEPTH-2 SHADOW PIN. `hasBadge` mounts a nested <al-badge> — a
      // custom element with its OWN shadow root — inside the avatar's shadow
      // tree. The captured anatomy is root(div.al-c-avatar) →
      // avatar__badge(al-badge) → badge(div.al-c-badge): the nested HOST is
      // kept as a part (it occupies a real box in its parent's layout) and its
      // own shadow child hangs beneath it. If the reader stopped at the first
      // shadow boundary, the badge subtree would simply not exist on canvas.
      const contractJson = JSON.stringify(contract);
      for (const part of ['avatar__badge', 'badge']) {
        if (!contractJson.includes(`"${part}"`)) {
          throw new Error(`avatar depth-2 pin: promoted contract carries no "${part}" part — the nested <al-badge> shadow root was not read`);
        }
      }
    }
    if (name === 'icon-close') {
      // THE SVG-IN-SHADOW PIN. The glyph is an inline <svg> inside
      // al-icon-close's shadow root — reachable ONLY through the shadow
      // reader — and the svg-content promotion reconstructed one asset per
      // size value. Assert real geometry reached figma.createNodeFromSvg.
      if (svgPayloads.length === 0) {
        throw new Error('icon-close svg-in-shadow pin: figma.createNodeFromSvg was never called — the glyph lives inside a shadow root and did not survive promotion into the emitted script');
      }
      const withPath = svgPayloads.filter((x) => /<path[^>]*\sd="[^"]{20,}"/.test(x));
      if (withPath.length === 0) {
        throw new Error(`icon-close svg-in-shadow pin: ${svgPayloads.length} svg payload(s) reached the canvas but none carries real <path d="..."> geometry — an empty glyph is not a glyph`);
      }
      if (svgPayloads.length !== got) {
        throw new Error(`icon-close svg-in-shadow pin: ${svgPayloads.length} glyph(s) for ${got} variant cells — every cell must carry the icon`);
      }
    }
    // D7 (task #37) — the HUG-CEILING pin: a root the capture MEASURED
    // hugging beneath its max-width must bind that cap as a Figma ceiling and
    // render strictly narrower than it. Shared implementation, one per
    // library (scripts/hug-ceiling-pin.mjs) — this is the pin that keeps the
    // 320-wide Carbon Button from coming back.
    {
      const hugFailures = checkHugCeiling({ contract, entry, mockRoot: mock.root, name });
      if (hugFailures.length > 0) throw new Error(hugFailures.join(' | '));
    }
    const set = mock.root.findAll((n) => n.type === 'COMPONENT_SET');
    rows.push(`| ${file} | ${contract.id} | ${axesLabel} | ${got} | tokens ${tok.total} (${tok.aliased} aliased) · ${set.length} set(s) built |`);
    totalVariants += got;
  } catch (e) {
    failures.push(`${file}: headless execute FAILED — ${e.message}`);
  }
}

const md = `# Altitude (altitude-web-components) Figma sync — compile receipt

Generated by \`examples/altitude/scripts/figma-compile-receipt.mjs\`. Regenerate any time;
refuses (exit 1) on drift. Scripts under \`examples/altitude/figma/\` emitted by
\`ds-contracts figma examples/altitude/contracts --out examples/altitude/figma --tokens
examples/altitude/tokens/altitude.dtcg.json,examples/altitude/tokens/altitude-minted.dtcg.json\`.

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
console.log(`✔ compile receipt: ${scripts.length} scripts, ${totalVariants} variants, tokens+aliases executed headlessly — examples/altitude/receipts/figma/COMPILE-RECEIPT.md`);
