/**
 * Depth Stage C receipt — the DYNAMIC CHILD-COLLECTION composite emits on ALL
 * FOUR surfaces.  `npx tsx examples/depth-composite/emit-composite-receipt.ts`
 *
 * Stage C proves the advanced-composition frontier: a MULTI-ROOT Modal whose
 * BODY holds composed children rather than only static leaf parts —
 *   · a SINGLE composed child   : a fixed `ds.card` instance (component-ref)
 *   · a DYNAMIC child-collection : a `ds.badge` item template REPEATED over the
 *                                  arrayOf `items` prop (the repeat channel)
 *
 * These channels already live in every emitter (nested `parts` + `component`,
 * and `repeat` + `component`); Stage C drives them together on a real
 * composite and PROVES each surface by EXECUTION (green parse != works), the
 * repo discipline:
 *
 *   · emit-react       → esbuild-bundle the CSS-module module + renderToStatic-
 *                        Markup. REAL markup: role="dialog" root → header,
 *                        body(<Card/> + N mapped <Badge/>), footer; a SIBLING
 *                        backdrop. The live `items` array maps to N badges.
 *   · emit-react-inline→ bundle + render the resolved-literal variant; the
 *                        observed `sample` renders as N fixed Badge instances.
 *   · emit-html        → static markup carries the card + the N sampled badges.
 *   · emit-figma-script→ the COMPONENTS payload referees (one variant frame,
 *                        body holds the summary instance + N repeated tag
 *                        instances) AND the script HEADLESS-EXECUTES in a VM
 *                        against the mocked `figma` global.
 *
 * Writes the emitted artifacts + RECEIPT.md into examples/depth-composite/.
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
const HERE = path.join(ROOT, 'examples', 'depth-composite');
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

const contract: Contract = ContractSchema.parse(
  read('examples/depth-composite/composite-modal.contract.json'),
);
// The composite embeds real repo children (ds.card, ds.badge, and ds.card's own
// ds.avatar) — load the whole repo contract set so the refs resolve on every
// surface exactly as they would under `npm run generate`.
const contracts = new Map<string, Contract>(
  readdirSync(path.join(ROOT, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .map((f) => ContractSchema.parse(read(path.join('contracts', f))))
    .map((c) => [c.id, c]),
);
contracts.set(contract.id, contract);

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
const name = contract.name;
const SAMPLE = ['Shipping', 'Gift wrap', 'Priority'];

mkdirSync(HERE, { recursive: true });
const failures: string[] = [];
const results: Array<{ surface: string; note: string; ok: boolean }> = [];
const check = (surface: string, ok: boolean, note: string) => {
  results.push({ surface, note, ok });
  if (!ok) failures.push(`${surface}: ${note}`);
  console.log(`  ${ok ? '✔' : '✘'} ${surface} — ${note}`);
};

// The emitted child modules the composite imports (Card, Badge, Avatar). The
// full-React surface bundles against generated child components; we stub them
// as minimal renderers so the composite's OWN structure (order, mapping, both
// roots) is what the bundle proves — the children have their own receipts.
function writeChildStub(file: string, comp: string, body: string): void {
  writeFileSync(file, `import { createElement } from 'react';\nexport function ${comp}(props: any) { return ${body}; }\n`);
}

// ---------------------------------------------------------------------------
// emit-react (CSS-module) -> esbuild bundle -> renderToStaticMarkup
// ---------------------------------------------------------------------------
const { tsx, css } = emitReact(contract, { tokens: new Set(), icons, contracts });
writeFileSync(path.join(HERE, `${name}.tsx`), tsx);
writeFileSync(path.join(HERE, `${name}.module.css`), css);

const work = path.join(HERE, '.work');
mkdirSync(work, { recursive: true });
writeFileSync(path.join(work, `${name}.tsx`), tsx);
writeFileSync(path.join(work, `${name}.module.css`), css);
// The generated tsx (copied into .work/) imports { Card } from '../Card' and
// { Badge } from '../Badge' — from .work/ those resolve to HERE/Card.tsx and
// HERE/Badge.tsx. Stub them as minimal renderers so the composite's OWN
// structure (order, live mapping, both roots) is what the bundle proves.
const CARD_STUB = "createElement('article', { 'data-card': props.title }, props.title, props.children)";
const BADGE_STUB = "createElement('span', { 'data-badge': true }, props.children)";
// full-React tsx imports '../Card' (from .work/ → HERE/Card.tsx);
// inline tsx imports './Card' (from .work/ → .work/Card.tsx).
writeChildStub(path.join(HERE, 'Card.tsx'), 'Card', CARD_STUB);
writeChildStub(path.join(HERE, 'Badge.tsx'), 'Badge', BADGE_STUB);
writeChildStub(path.join(work, 'Card.tsx'), 'Card', CARD_STUB);
writeChildStub(path.join(work, 'Badge.tsx'), 'Badge', BADGE_STUB);
writeFileSync(
  path.join(work, 'entry.tsx'),
  [
    "import { createElement } from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server';",
    `import { ${name} } from './${name}';`,
    `import styles from './${name}.module.css';`,
    `export const markup = renderToStaticMarkup(createElement(${name}, { items: ${JSON.stringify(
      SAMPLE.map((t) => ({ children: t })),
    )} }));`,
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
  const cardOk = markup.includes('data-card="Order summary"');
  const collectionOk = SAMPLE.every((t) => markup.includes(`data-badge="true">${t}</span>`));
  const dialogClass = classMap['dialog'];
  const backdropClass = classMap['backdrop'];
  const bothRoots =
    typeof dialogClass === 'string' && dialogClass.length > 0 && markup.includes(dialogClass) &&
    typeof backdropClass === 'string' && backdropClass.length > 0 && markup.includes(backdropClass);
  const noNaN = !markup.includes('NaN');
  check('emit-react', roleOk && cardOk && collectionOk && bothRoots && noNaN,
    `rendered a real modal whose body holds a composed <Card> + the live items array mapped to ${SAMPLE.length} <Badge> children (order preserved), sibling backdrop, both root classes, no NaN`);
}

// ---------------------------------------------------------------------------
// emit-react-inline -> bundle -> render (the observed sample renders inline)
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
    inlineMarkup.includes('data-card="Order summary"') &&
    SAMPLE.every((t) => inlineMarkup.includes(`data-badge="true">${t}</span>`)) &&
    !inlineMarkup.includes('NaN');
  check('emit-react-inline', ok,
    `resolved-literal variant renders the composed card + the observed sample as ${SAMPLE.length} fixed Badge instances, no NaN`);
}

// ---------------------------------------------------------------------------
// emit-html -> static markup (card + N sampled badges)
// ---------------------------------------------------------------------------
const { html, css: htmlCss } = emitHtml(contract, {
  tokens: tokenInventoryFromJson([tokens.primitives, tokens.semantic, tokens.light, tokens.dark]),
  icons,
  contracts,
});
writeFileSync(path.join(HERE, `${name}.html`), html);
writeFileSync(path.join(HERE, `${name}.html.css`), htmlCss);
{
  const k = 'composite-modal';
  const ok =
    html.includes(`class="${k}__dialog" role="dialog" aria-modal="true"`) &&
    html.includes(`class="${k}__backdrop"`) &&
    html.includes('class="card"') &&
    html.includes('Order summary') &&
    SAMPLE.every((t) => html.includes(`role="status">\n          ${t}`)) &&
    !/className=|forwardRef|\{children\}/.test(html);
  check('emit-html', ok,
    `static markup carries the composed card + ${SAMPLE.length} sampled badges inside the dialog body, backdrop sibling, no React syntax`);
}

// ---------------------------------------------------------------------------
// emit-figma-script -> referee (COMPONENTS payload) + headless execute (VM)
// ---------------------------------------------------------------------------
const figmaScript = emitFigmaScript(contract, { tokens, icons, contracts });
writeFileSync(path.join(HERE, `${name}.figma.js`), figmaScript);
{
  const m = figmaScript.match(/const COMPONENTS = (\[[\s\S]*?\n\]);/);
  let refereeOk = false;
  let bodyKids: string[] = [];
  if (m) {
    const comp = JSON.parse(m[1])[0];
    const spec = comp.variants?.[0]?.spec ?? comp.variants?.[0];
    const roots = (spec?.children ?? []) as Array<{ name: string; children?: Array<{ name: string }> }>;
    const dialog = roots.find((r) => r.name === 'dialog');
    const body = (dialog?.children ?? []).find((c: { name: string }) => c.name === 'body') as
      | { children?: Array<{ name: string; type?: string }> }
      | undefined;
    bodyKids = (body?.children ?? []).map((c) => c.name);
    const tagInstances = bodyKids.filter((n) => n === 'tags' || /^tags \d+$/.test(n));
    refereeOk =
      comp.setName === name &&
      comp.contractId === contract.id &&
      (comp.variants ?? []).length === 1 &&
      roots.some((r) => r.name === 'dialog') &&
      roots.some((r) => r.name === 'backdrop') &&
      bodyKids.includes('summary') &&
      tagInstances.length === SAMPLE.length;
  }
  check('emit-figma-script (referee)', refereeOk,
    `COMPONENTS payload parses — one variant frame; the dialog body holds the composed summary instance + ${SAMPLE.length} repeated tag instances [${bodyKids.join(', ')}]`);

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
    ranHeadless
      ? 'the whole script ran to completion in a VM against the mocked figma global (no Figma, no network) — composed + repeated instances built'
      : `threw — ${runNote}`);
}

// ---------------------------------------------------------------------------
// RECEIPT.md
// ---------------------------------------------------------------------------
const rows = results.map((r) => `| ${r.surface} | ${r.ok ? '✓' : '✘'} | ${r.note} |`).join('\n');
const receipt = `# Depth Stage C — the dynamic child-collection composite emits on all four surfaces

Rebuild: \`npx tsx examples/depth-composite/emit-composite-receipt.ts\`

Stage C is the advanced-composition frontier on top of the multi-root emitter
path: a MULTI-ROOT Modal (\`ds.composite-modal\` = {dialog, backdrop}) whose
**body holds composed children**, not only static leaf parts —

- a **single composed child**: a fixed \`ds.card\` instance (a \`component\` ref);
- a **dynamic child-collection**: a \`ds.badge\` item template **repeated** over
  the arrayOf \`items\` prop (the \`repeat\` + \`component\` channel).

Both channels already live in every emitter (nested \`parts\` + \`component\`, and
\`repeat\` + \`component\`). This receipt drives them **together** on a real
composite and proves each surface by EXECUTION (green parse ≠ works).

## Per-surface rendering decision

| surface | composed child (\`ds.card\`) | dynamic collection (\`ds.badge\` × items) |
|---|---|---|
| emit-react | \`<Card title="Order summary" />\` in body | \`{items?.map((item, i) => <Badge key={i}>{item.children}</Badge>)}\` — the LIVE array (undefined renders nothing) |
| emit-react-inline | \`<Card title="Order summary" />\` | the OBSERVED \`sample\` as N fixed \`<Badge>\` instances (resolved literals) |
| emit-html | \`<article class="card">…\` | the OBSERVED \`sample\` as N \`<span class="badge">\` siblings |
| emit-figma-script | a \`summary\` INSTANCE node in the body frame | N repeated \`tags\`/\`tags 2\`/… INSTANCE nodes (the sample), children of the body frame |

Children render **in order** inside the body; the collection is REAL repeated
instances on every static surface (the sample), never a single placeholder.
A genuinely single-root contract, and every existing \`repeat\` user, takes the
untouched path — golden output is byte-for-byte unchanged.

## Proof (${results.filter((r) => r.ok).length}/${results.length} surfaces)

| surface | pass | what executed |
|---|---|---|
${rows}

## Emitted artifacts (committed as receipts)

- \`${name}.tsx\` + \`${name}.module.css\` — CSS-module React component
- \`${name}.inline.tsx\` — resolved-literal React component
- \`${name}.html\` + \`${name}.html.css\` — static HTML + CSS
- \`${name}.figma.js\` — Figma Plugin API sync script (one frame; body holds the composed + repeated instances)
`;
writeFileSync(path.join(HERE, 'RECEIPT.md'), receipt);

// tidy the bundle scratch + child stubs (the artifacts above are the receipts)
try {
  execFileSync('rm', ['-rf', work, path.join(HERE, 'Card.tsx'), path.join(HERE, 'Badge.tsx')]);
} catch {
  /* best-effort */
}

if (failures.length > 0) {
  console.error(`\n✘ Stage C composite receipt FAILED:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`\n✔ Stage C composite: all ${results.length} surfaces emitted + EXECUTED → examples/depth-composite/RECEIPT.md`);
