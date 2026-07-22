/**
 * Astryx dev-journey — Figma sync-script compile receipt.
 *   `node examples/astryx/scripts/figma-compile-receipt.mjs`
 *
 * The genesis-prep leg: `ds-contracts figma examples/astryx/contracts --out
 * examples/astryx/figma --tokens …` emits one Figma Plugin API sync script per
 * flagship contract. A future bridge run compiles these into a BLANK Figma
 * file = the FIRST Astryx Figma library (no live canvas here — owner + bridge
 * later). This receipt proves each script is real, two ways (the repo's
 * established referee + compile-receipt patterns):
 *
 *   1. REFEREE / COMPILE PRODUCT — parse the emitted `const COMPONENTS = […]`
 *      payload (createFigmaEngine's build product, the exact
 *      parseSyncComponent shape evals/run.ts uses) and assert set identity +
 *      variant counts against each contract's declared axes.
 *   2. HEADLESS EXECUTE — run every script in a VM against the mocked `figma`
 *      global (scripts/plugin-engine-mock-figma.mjs, the plugin-engine-check
 *      pattern) — no Figma, no network — and require it to run to completion
 *      without throwing (it creates the component set in the mock file).
 *
 * Writes examples/astryx/receipts/figma/COMPILE-RECEIPT.md; exits non-zero
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

// Expected variant counts = the product of each contract's variant-bearing
// enum axes (the canvas grid the emitter compiles).
const EXPECT = {
  'badge.figma.js':          { set: 'Badge',         id: 'astryx.badge',          variants: 14, axes: 'variant(14)' },
  'banner.figma.js':         { set: 'Banner',        id: 'astryx.banner',         variants: 8,  axes: 'status(4)×container(2)' },
  'button.figma.js':         { set: 'Button',        id: 'astryx.button',         variants: 12, axes: 'variant(4)×size(3)' },
  'card.figma.js':           { set: 'Card',          id: 'astryx.card',           variants: 13, axes: 'variant(13)' },
  'checkbox-input.figma.js': { set: 'CheckboxInput', id: 'astryx.checkbox-input', variants: 2,  axes: 'size(2)' },
  'progress-bar.figma.js':   { set: 'ProgressBar',   id: 'astryx.progress-bar',   variants: 5,  axes: 'variant(5)' },
  'slider.figma.js':         { set: 'Slider',        id: 'astryx.slider',         variants: 6,  axes: 'orientation(2)×valueDisplay(3)' },
  'switch.figma.js':         { set: 'Switch',        id: 'astryx.switch',         variants: 2,  axes: 'labelPosition(2)' },
  'text-input.figma.js':     { set: 'TextInput',     id: 'astryx.text-input',     variants: 9,  axes: 'type(3)×size(3)' },
  'token.figma.js':          { set: 'Token',         id: 'astryx.token',          variants: 33, axes: 'size(3)×color(11)' },
  // Phase B — the composition set (extracted round 1–2, promoted 2026-07-22).
  // Standalone COMPONENTs (no enum axes); the composed two execute in the
  // SHARED dependency-ordered mock pass below, not the per-file fresh mock
  // (their instance refs need Button / DropdownMenuItem already synced).
  'dropdown-menu-item.figma.js': { set: 'DropdownMenuItem', id: 'astryx.dropdown-menu-item', variants: 1, axes: 'standalone', standalone: true },
  'dropdown-menu.figma.js':      { set: 'DropdownMenu',     id: 'astryx.dropdown-menu',      variants: 1, axes: 'standalone multi-root', standalone: true, composed: true },
  'toast.figma.js':              { set: 'Toast',            id: 'astryx.toast',              variants: 1, axes: 'standalone', standalone: true, composed: true },
};

const parseComponents = (script) =>
  JSON.parse(script.match(/const COMPONENTS = (\[[\s\S]*?\n\]);/)[1]);

// --- token-synced file simulation ------------------------------------------
// The emitted component scripts BIND variables that a token sync must have
// already created. Astryx's StyleX tokens are LITERAL (not aliases into
// primitives), so a genesis token sync creates literal variables — which the
// repo engine's alias-based buildTokensScript does not model (a NAMED limit,
// see COMPILE-RECEIPT.md / DEV-JOURNEY.md). Here we seed the mock file with
// exactly those literal variables (the token-synced starting state) so the
// component scripts' `need(name)` bindings resolve.
const DTCG = JSON.parse(readFileSync(path.join(EX, 'tokens', 'astryx.dtcg.json'), 'utf8'));
function hexToRgba(v) {
  const s = String(v).trim();
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) {
    const p = m[1].split(',').map((x) => parseFloat(x.trim()));
    return { r: (p[0] || 0) / 255, g: (p[1] || 0) / 255, b: (p[2] || 0) / 255, a: p[3] === undefined ? 1 : p[3] };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}
function seedTokenVariables(figma) {
  const col = figma.variables.createVariableCollection('Astryx');
  const modeId = col.modes[0].modeId;
  for (const [name, entry] of Object.entries(DTCG)) {
    if (!entry || typeof entry !== 'object' || !('$value' in entry)) continue;
    const type = entry.$type;
    const figType = type === 'color' ? 'COLOR' : type === 'dimension' || type === 'number' ? 'FLOAT' : 'STRING';
    const v = figma.variables.createVariable(name, col, figType);
    const raw = entry.$value;
    v.setValueForMode(
      modeId,
      figType === 'COLOR' ? hexToRgba(raw) : figType === 'FLOAT' ? parseFloat(String(raw)) || 0 : String(raw),
    );
  }
}

const failures = [];
const rows = [];
let totalVariants = 0;

const scripts = readdirSync(FIGMA_DIR).filter((f) => f.endsWith('.figma.js')).sort();
if (scripts.length !== Object.keys(EXPECT).length) {
  failures.push(`expected ${Object.keys(EXPECT).length} scripts, found ${scripts.length}`);
}

for (const file of scripts) {
  const exp = EXPECT[file];
  if (!exp) {
    failures.push(`${file}: no expectation entry`);
    continue;
  }
  const script = readFileSync(path.join(FIGMA_DIR, file), 'utf8');

  // 1. referee / compile product
  let comp;
  try {
    comp = parseComponents(script)[0];
  } catch (e) {
    failures.push(`${file}: COMPONENTS payload did not parse — ${String(e)}`);
    continue;
  }
  if (comp.setName !== exp.set) failures.push(`${file}: setName ${comp.setName} !== ${exp.set}`);
  if (comp.contractId !== exp.id) failures.push(`${file}: contractId ${comp.contractId} !== ${exp.id}`);
  if (comp.isSet !== !exp.standalone) failures.push(`${file}: isSet ${comp.isSet} !== ${!exp.standalone}`);
  const variants = comp.variants ?? comp.data?.variants ?? [];
  if (variants.length !== exp.variants) {
    failures.push(`${file}: compiled ${variants.length} variants, expected ${exp.variants} (${exp.axes})`);
  }
  totalVariants += variants.length;

  // 2. headless execute against the mock figma — the real bridge flow syncs
  //    tokens FIRST, so each component script runs in a fresh mock file whose
  //    token variables are already synced (seedTokenVariables).
  let ran = false;
  let runNote = '';
  if (exp.composed) {
    ran = true; // executed in the shared dependency-ordered pass below
    runNote = 'composed pass';
  } else {
    try {
      const { figma } = createFigmaMock();
      seedTokenVariables(figma);
      const ctx = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
      await vm.runInContext(`(async () => {\n${script}\n})()`, ctx, { timeout: 120_000 });
      ran = true;
    } catch (e) {
      runNote = String(e && e.message ? e.message : e);
      failures.push(`${file}: headless execute threw — ${runNote}`);
    }
  }

  rows.push(
    `| \`${file}\` | \`${comp.setName}\` | ${variants.length} | ${exp.axes} | ${ran ? (exp.composed ? '✓ composed pass' : '✓ ran') : '✘'} |`,
  );
}

// --- 3. COMPOSITION PASS (Phase B): the composed scripts run in ONE shared
// mock file, dependency-ordered — exactly the plugin's Receive flow — and
// the BUILT trees are asserted: repeated item instances carry their sample
// labels, the trigger/dismiss Button instances carry their applied Label,
// and the multi-root split survives. This is the composite-plugin-path
// pattern applied to a foreign system's extracted contracts.
{
  const order = ['button.figma.js', 'dropdown-menu-item.figma.js', 'dropdown-menu.figma.js', 'toast.figma.js'];
  const { figma, root } = createFigmaMock();
  seedTokenVariables(figma);
  const ctx = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  try {
    for (const file of order) {
      const script = readFileSync(path.join(FIGMA_DIR, file), 'utf8');
      await vm.runInContext(`(async () => {\n${script}\n})()`, ctx, { timeout: 120_000 });
    }
    const find = (name) => root.findOne((n) => n.type === 'COMPONENT' && n.name === name);
    const texts = (n) => (n ? n.findAll((x) => x.type === 'TEXT').map((t) => t.characters) : []);

    const dd = find('DropdownMenu');
    if (!dd) failures.push('composition: DropdownMenu COMPONENT not built');
    else {
      const rootNames = dd.children.map((c) => c.name);
      if (!rootNames.includes('trigger') || !rootNames.includes('menu')) {
        failures.push(`composition: DropdownMenu roots ${JSON.stringify(rootNames)} missing trigger/menu`);
      }
      const menu = dd.children.find((c) => c.name === 'menu');
      const items = (menu?.children ?? []).filter((c) => c.type === 'INSTANCE');
      const itemTexts = items.map((i) => texts(i)[0]);
      if (JSON.stringify(itemTexts) !== JSON.stringify(['Edit', 'Duplicate', 'Delete'])) {
        failures.push(`composition: DropdownMenu repeated item labels ${JSON.stringify(itemTexts)} !== [Edit, Duplicate, Delete]`);
      }
      const trigger = dd.children.find((c) => c.name === 'trigger');
      if (trigger?.type !== 'INSTANCE' || !texts(trigger).includes('Options')) {
        failures.push(`composition: DropdownMenu trigger is not a Button INSTANCE labeled "Options" (${trigger?.type}, texts ${JSON.stringify(texts(trigger))})`);
      }
      if (!(menu && menu.width >= 200)) {
        failures.push(`composition: DropdownMenu menu width ${menu?.width} — collapse class (expected ≥200 from the 240px literal)`);
      }
    }

    const toast = find('Toast');
    if (!toast) failures.push('composition: Toast COMPONENT not built');
    else {
      const t = texts(toast);
      if (!t.includes('Saved successfully')) failures.push(`composition: Toast body text missing (texts ${JSON.stringify(t)})`);
      if (!t.includes('Dismiss')) failures.push(`composition: Toast dismiss Button label not applied (texts ${JSON.stringify(t)})`);
      if (!(toast.width >= 300)) failures.push(`composition: Toast width ${toast.width} — collapse class (expected ≥300 from the 360px literal)`);
    }
  } catch (e) {
    failures.push(`composition pass threw — ${String(e && e.message ? e.message : e)}`);
  }
}

const receiptDir = path.join(EX, 'receipts', 'figma');
mkdirSync(receiptDir, { recursive: true });
const receipt = `# Astryx dev-journey — Figma sync-script compile receipt

Genesis prep. \`ds-contracts figma examples/astryx/contracts --out
examples/astryx/figma --tokens examples/astryx/tokens/astryx.dtcg.json\` emits
one Figma Plugin API sync script per flagship contract. A future bridge run
builds these into a **blank Figma file** = the FIRST Astryx Figma library
(Astryx ships no official kit as of 0.1.6 — see ../../PROVENANCE.md). No live
canvas is driven here (owner + bridge later).

Rebuild: \`node examples/astryx/scripts/figma-compile-receipt.mjs\`

Each script is proven two ways, the repo's own patterns:
1. **Referee / compile product** — the emitted \`const COMPONENTS = […]\`
   payload (createFigmaEngine's build product, the parseSyncComponent shape
   from evals/run.ts) parses and its set identity + variant grid match the
   contract's declared axes.
2. **Headless execute** — the whole script runs in a VM against the mocked
   \`figma\` global (scripts/plugin-engine-mock-figma.mjs, the
   plugin-engine-check pattern), no Figma / no network, to completion. The
   mock file is pre-seeded with the Astryx token variables (the token-synced
   starting state the bridge produces before component sync).

> **Named limitation (honest):** Astryx's StyleX tokens are **literal**
> values, not aliases into a primitive layer. The repo engine's
> \`buildTokensScript\` assumes the repo's alias architecture, so it does not
> emit a token-sync script for a literal token set. The genesis bundle
> therefore still needs a literal-variable token sync (the bridge / plugin
> creates these; this receipt seeds them directly). Wiring a literal-token
> \`buildTokensScript\` path is a follow-up, not this round.

## ${scripts.length} scripts · ${totalVariants} component-set variants compiled

| script | set | variants | axes | headless run |
|---|---|---|---|---|
${rows.join('\n')}

Total: **${totalVariants} variants across ${scripts.length} component sets.**
`;
writeFileSync(path.join(receiptDir, 'COMPILE-RECEIPT.md'), receipt);

if (failures.length > 0) {
  console.error('✘ figma compile receipt FAILED:\n' + failures.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(
  `✔ figma compile receipt: ${scripts.length}/${scripts.length} scripts referee-pass + headless-run; ` +
    `${totalVariants} variants compiled → receipts/figma/COMPILE-RECEIPT.md`,
);
