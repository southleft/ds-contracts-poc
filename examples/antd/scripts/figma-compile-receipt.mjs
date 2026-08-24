/**
 * Ant Design dev-journey — Figma sync-script compile receipt.
 *   `node examples/antd/scripts/figma-compile-receipt.mjs`
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
 * examples/antd/contracts/, never by transforming the script filename (the
 * Fluent lesson: a filename transform is a guess that becomes a silent
 * mismatch).
 *
 * Writes examples/antd/receipts/figma/COMPILE-RECEIPT.md; exits non-zero
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

/** ANTD STRUCTURAL PINS — one per class of thing the exam claims. Each is the
 *  sample text the capture config mounted; a set that builds without it has
 *  lost its label, whatever the variant count says. */
const TEXT_PINS = {
  button: 'Button',
  tag: 'Tag',
  checkbox: 'Checkbox',
  radio: 'Radio',
  avatar: 'A',
  card: 'Card title',
  alert: 'Alert message',
  progress: '40%',
  tooltip: 'Tooltip text',
};

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
    failures.push(`${file}: payload contractId ${entry?.contractId} matches no contract in examples/antd/contracts/ (ids: ${[...BY_ID.keys()].join(', ')})`);
    continue;
  }
  const variantAxes = (contract.props ?? []).filter((p) => p.bindings?.figma?.kind === 'VARIANT' && p.type?.enum);
  const expectedVariants = variantAxes.reduce((n, p) => n * p.type.enum.length, 1);
  const axesLabel = variantAxes.length ? variantAxes.map((p) => `${p.name}(${p.type.enum.length})`).join('×') : 'standalone';

  const got = entry.variants?.length ?? 1;
  if (got !== expectedVariants) {
    failures.push(`${file}: variant grid ${got} ≠ contract axes product ${expectedVariants} (${axesLabel})`);
  }

  let textOverflowCount = 0;
  try {
    const mock = createFigmaMock();
    const tok = await runScript(mock.figma, TOKENS_SCRIPT);
    if (!tok || typeof tok.total !== 'number') throw new Error('token sync returned no receipt');
    await runScript(mock.figma, src);

    const textIs = (s) => mock.root.findAll((n) => n.type === 'TEXT' && n.characters === s);
    const pin = TEXT_PINS[name];
    if (pin && textIs(pin).length === 0) {
      throw new Error(`${name} pin: no TEXT node carrying ${JSON.stringify(pin)} — the sample text the capture mounted did not reach the canvas`);
    }
    {
      const { textCaused } = countChildWider(mock.root);
      textOverflowCount = textCaused;
    }
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

const md = `# Ant Design Figma sync — compile receipt

Generated by \`examples/antd/scripts/figma-compile-receipt.mjs\`. Regenerate any time;
refuses (exit 1) on drift. Scripts under \`examples/antd/figma/\` emitted by
\`ds-contracts figma examples/antd/contracts --out examples/antd/figma --icons
examples/antd/assets/icons --tokens
examples/antd/tokens/antd.dtcg.json,examples/antd/tokens/antd-minted.dtcg.json\`.

Subject: \`antd@5.29.3\` (@ant-design/cssinjs runtime CSS-in-JS), captured through the
\`<ConfigProvider theme={{ cssVar: { key: 'antd' }, hashed: false, token: { fontFamily } }}
wave={{ disabled: true }}>\` mount — all 350 global + 152 component custom properties are
declared on the \`.antd\` key class every component root carries, never on \`:root\`
(RECON §2.5; the four pins are measured in examples/antd/README.md).

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
console.log(`✔ compile receipt: ${scripts.length} scripts, ${totalVariants} variants, tokens+aliases executed headlessly — examples/antd/receipts/figma/COMPILE-RECEIPT.md`);
