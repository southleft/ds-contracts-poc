/**
 * Advanced-composition receipt — the MULTI-ROOT Modal emits on ALL FOUR
 * surfaces.  `npx tsx examples/depth-modal/emit-modal-receipt.ts`
 *
 * The depth north star (both journey directions) needed the emitters + the
 * validator to consume MULTI-ROOT anatomy: a captured composite (Modal =
 * {dialog, backdrop}) must render to code AND to a Figma set. This script
 * takes the assembled schema-valid composite contract (modal-composite.
 * contract.json — two top-level roots, promoted from the depth capture at
 * extract/computed/depth/receipts/modal.anatomy.json) and PROVES each surface,
 * the same way the repo proves every other emitter (execute, don't eyeball):
 *
 *   · emit-react       → esbuild-bundle the CSS-module module + renderToStatic-
 *                        Markup (react-dom/server). REAL modal markup: a
 *                        role="dialog" root with header→(title + close),
 *                        body, footer→(Cancel + Save); a SIBLING backdrop.
 *   · emit-react-inline→ bundle + render the resolved-literal variant.
 *   · emit-html        → static markup carries dialog + backdrop + both actions.
 *   · emit-figma-script→ the COMPONENTS payload parses (the parseSyncComponent
 *                        shape evals/run.ts referees) AND the script headless-
 *                        executes in a VM against the mocked `figma` global
 *                        (scripts/plugin-engine-mock-figma.mjs). The single
 *                        variant frame contains BOTH roots as children.
 *
 * Writes the emitted artifacts + RECEIPT.md into examples/depth-modal/.
 * Exits non-zero (named) on any failure.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { emitFigmaScript } from '../../core/emit-figma-script.js';
import { emitHtml } from '../../core/emit-html.js';
import { emitReact } from '../../core/emit-react.js';
import { emitReactInline } from '../../core/emit-react-inline.js';
import { tokenInventoryFromJson } from '../../core/tokens.js';
// @ts-expect-error — plain .mjs mock, no types
import { createFigmaMock } from '../../scripts/plugin-engine-mock-figma.mjs';

const ROOT = process.cwd();
const HERE = path.join(ROOT, 'examples', 'depth-modal');
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

const contract: Contract = ContractSchema.parse(
  read('examples/depth-modal/modal-composite.contract.json'),
);
const icons = new Map<string, string>(
  readdirSync(path.join(ROOT, 'assets', 'icons'))
    .filter((f) => f.endsWith('.svg'))
    .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(ROOT, 'assets', 'icons', f), 'utf8').trim()]),
);
const brands = Object.fromEntries(
  readdirSync(path.join(ROOT, 'tokens', 'modes'))
    .filter((f) => /^brand\.[a-z][a-z0-9-]*\.tokens\.json$/.test(f))
    .map((f) => [f.replace(/^brand\.|\.tokens\.json$/g, ''), read(`tokens/modes/${f}`)]),
);
const tokens = {
  primitives: read('tokens/primitives.tokens.json'),
  semantic: read('tokens/semantic.tokens.json'),
  light: read('tokens/modes/semantic.light.tokens.json'),
  dark: read('tokens/modes/semantic.dark.tokens.json'),
  brands,
};
const contracts = new Map([[contract.id, contract]]);
const name = contract.name;

mkdirSync(HERE, { recursive: true });
const failures: string[] = [];
const results: Array<{ surface: string; note: string; ok: boolean }> = [];
const check = (surface: string, ok: boolean, note: string) => {
  results.push({ surface, note, ok });
  if (!ok) failures.push(`${surface}: ${note}`);
  console.log(`  ${ok ? '✔' : '✘'} ${surface} — ${note}`);
};

// ---------------------------------------------------------------------------
// emit-react (CSS-module) → esbuild bundle → renderToStaticMarkup
// ---------------------------------------------------------------------------
const { tsx, css } = emitReact(contract, { tokens: new Set(), icons, contracts });
writeFileSync(path.join(HERE, `${name}.tsx`), tsx);
writeFileSync(path.join(HERE, `${name}.module.css`), css);

const work = path.join(HERE, '.work');
mkdirSync(work, { recursive: true });
writeFileSync(path.join(work, `${name}.tsx`), tsx);
writeFileSync(path.join(work, `${name}.module.css`), css);
writeFileSync(
  path.join(work, 'entry.tsx'),
  [
    "import { createElement } from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server';",
    `import { ${name} } from './${name}';`,
    `import styles from './${name}.module.css';`,
    `export const markup = renderToStaticMarkup(createElement(${name}));`,
    'export const classMap = styles;',
  ].join('\n'),
);
await build({
  entryPoints: [path.join(work, 'entry.tsx')],
  outfile: path.join(work, 'entry.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  logLevel: 'silent',
  loader: { '.css': 'local-css' },
  external: ['react', 'react-dom'],
});
const mod = await import(pathToFileURL(path.join(work, 'entry.cjs')).href);
const markup: string = (mod.default ?? mod).markup;
const classMap: Record<string, string> = (mod.default ?? mod).classMap;
{
  const roleOk = /role="dialog"/.test(markup) && /aria-modal="true"/.test(markup);
  const structureOk = ['Order details', 'Body copy inside a sectioned modal.', 'Cancel', 'Save'].every((t) => markup.includes(t));
  const closeOk = markup.includes('aria-label="Close"') && markup.includes('<button');
  const dialogClass = classMap['dialog'];
  const backdropClass = classMap['backdrop'];
  const bothRoots =
    typeof dialogClass === 'string' && dialogClass.length > 0 && markup.includes(dialogClass) &&
    typeof backdropClass === 'string' && backdropClass.length > 0 && markup.includes(backdropClass);
  const noNaN = !markup.includes('NaN');
  check('emit-react', roleOk && structureOk && closeOk && bothRoots && noNaN,
    `rendered a real modal — role="dialog" + header(title,close) + body + footer(Cancel,Save), sibling backdrop, both root classes present, no NaN`);
}

// ---------------------------------------------------------------------------
// emit-react-inline → bundle → render
// ---------------------------------------------------------------------------
const inline = emitReactInline(contract, { tokens, icons, contracts, mode: 'light' });
writeFileSync(path.join(HERE, `${name}.inline.tsx`), inline.tsx);
writeFileSync(path.join(work, `${name}Inline.tsx`), inline.tsx);
writeFileSync(
  path.join(work, 'inline-entry.tsx'),
  [
    "import { createElement } from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server';",
    `import { ${name} } from './${name}Inline';`,
    `export const markup = renderToStaticMarkup(createElement(${name}));`,
  ].join('\n'),
);
await build({
  entryPoints: [path.join(work, 'inline-entry.tsx')],
  outfile: path.join(work, 'inline-entry.cjs'),
  bundle: true,
  format: 'cjs',
  platform: 'node',
  jsx: 'automatic',
  logLevel: 'silent',
  external: ['react', 'react-dom'],
});
const imod = await import(pathToFileURL(path.join(work, 'inline-entry.cjs')).href);
const inlineMarkup: string = (imod.default ?? imod).markup;
{
  const ok =
    /role="dialog"/.test(inlineMarkup) &&
    ['Order details', 'Cancel', 'Save'].every((t) => inlineMarkup.includes(t)) &&
    !inlineMarkup.includes('NaN');
  check('emit-react-inline', ok, 'resolved-literal variant renders the same modal (dialog + actions), no NaN');
}

// ---------------------------------------------------------------------------
// emit-html → static markup
// ---------------------------------------------------------------------------
const { html, css: htmlCss } = emitHtml(contract, {
  tokens: tokenInventoryFromJson([tokens.primitives, tokens.semantic, tokens.light, tokens.dark]),
  icons,
  contracts,
});
writeFileSync(path.join(HERE, `${name}.html`), html);
writeFileSync(path.join(HERE, `${name}.html.css`), htmlCss);
{
  const k = 'modal-composite';
  const ok =
    html.includes(`class="${k}__dialog" role="dialog" aria-modal="true"`) &&
    html.includes(`class="${k}__backdrop"`) &&
    ['Order details', 'Body copy inside a sectioned modal.', 'Cancel', 'Save'].every((t) => html.includes(t)) &&
    !/className=|forwardRef|\{children\}/.test(html);
  check('emit-html', ok, 'static markup carries dialog(role) + backdrop siblings + both actions, no React syntax');
}

// ---------------------------------------------------------------------------
// emit-figma-script → referee (COMPONENTS payload) + headless execute (VM)
// ---------------------------------------------------------------------------
const figmaScript = emitFigmaScript(contract, { tokens, icons, contracts });
writeFileSync(path.join(HERE, `${name}.figma.js`), figmaScript);
{
  const m = figmaScript.match(/const COMPONENTS = (\[[\s\S]*?\n\]);/);
  let refereeOk = false;
  let rootChildren: string[] = [];
  let variantCount = 0;
  if (m) {
    const comp = JSON.parse(m[1])[0];
    variantCount = (comp.variants ?? []).length;
    const spec = comp.variants?.[0]?.spec ?? comp.variants?.[0];
    rootChildren = (spec?.children ?? []).map((c: { name: string }) => c.name);
    refereeOk =
      comp.setName === name &&
      comp.contractId === contract.id &&
      variantCount === 1 &&
      rootChildren.includes('dialog') &&
      rootChildren.includes('backdrop');
  }
  check('emit-figma-script (referee)', refereeOk,
    `COMPONENTS payload parses — one variant frame whose children are the ${rootChildren.length} roots [${rootChildren.join(', ')}]`);

  let ranHeadless = false;
  let runNote = '';
  try {
    const { figma } = createFigmaMock();
    const ctx = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    await vm.runInContext(`(async () => {\n${figmaScript}\n})()`, ctx, { timeout: 120_000 });
    ranHeadless = true;
  } catch (e) {
    runNote = String(e instanceof Error ? e.message : e);
  }
  check('emit-figma-script (headless)', ranHeadless,
    ranHeadless ? 'the whole script ran to completion in a VM against the mocked figma global (no Figma, no network)' : `threw — ${runNote}`);
}

// ---------------------------------------------------------------------------
// RECEIPT.md
// ---------------------------------------------------------------------------
const rows = results.map((r) => `| ${r.surface} | ${r.ok ? '✓' : '✘'} | ${r.note} |`).join('\n');
const receipt = `# Advanced composition — the multi-root Modal emits on all four surfaces

Rebuild: \`npx tsx examples/depth-modal/emit-modal-receipt.ts\`

The depth north star (both journeys) needed the emitters + validator to consume
**multi-root anatomy**. A single-root contract's anatomy is the N=1 special
case of \`Record<string, Part>\`; a captured composite carries several top-level
roots. This receipt drives the assembled composite \`ds.modal-composite\`
(\`modal-composite.contract.json\` — two roots \`{dialog, backdrop}\`, promoted
from the depth capture \`extract/computed/depth/receipts/modal.anatomy.json\`)
through **every** emitter and proves each — by EXECUTION, the repo's discipline
(green parse ≠ works).

## Per-surface multi-root rendering decision

| surface | N roots become | wrapper? |
|---|---|---|
| emit-html | sibling elements (\`.modal-composite__dialog\`, \`.modal-composite__backdrop\`) | none — position-driven siblings |
| emit-react | siblings inside a \`<>…</>\` Fragment | none |
| emit-react-inline | siblings inside a Fragment (resolved-literal styles) | none |
| emit-figma-script | children of ONE variant frame | synthetic container frame — a Figma variant IS one frame, so multi-root needs a parent; single-root NEVER gets one (byte-identical) |

A genuinely single-root contract takes the **untouched N=1 path** in every
emitter, so \`npm run generate\` + \`npm run figma:plan\` are byte-for-byte
unchanged (the golden invariant).

## Proof (${results.filter((r) => r.ok).length}/${results.length} surfaces)

| surface | pass | what executed |
|---|---|---|
${rows}

## Emitted artifacts (committed as receipts)

- \`${name}.tsx\` + \`${name}.module.css\` — CSS-module React component
- \`${name}.inline.tsx\` — resolved-literal React component
- \`${name}.html\` + \`${name}.html.css\` — static HTML + CSS
- \`${name}.figma.js\` — Figma Plugin API sync script (one frame, two roots)
`;
writeFileSync(path.join(HERE, 'RECEIPT.md'), receipt);

// tidy the bundle scratch (artifacts above are the receipts)
try {
  execFileSync('rm', ['-rf', work]);
} catch {
  /* best-effort */
}

if (failures.length > 0) {
  console.error(`\n✘ multi-root Modal receipt FAILED:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`\n✔ multi-root Modal: all ${results.length} surfaces emitted + EXECUTED → examples/depth-modal/RECEIPT.md`);
