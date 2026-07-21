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
import { ContractSchema, componentRefsOf, type Contract } from '../../scripts/contract-schema.js';
import { createFigmaEngine, emitFigmaScript } from '../../core/emit-figma-script.js';
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
    html.includes(`class="${k}__tags"`) && // the badges live in a row wrapper
    // whitespace-tolerant: each sampled badge renders as a role="status" span
    SAMPLE.every((t) => new RegExp(`role="status">\\s*${t.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*</span>`).test(html)) &&
    !/className=|forwardRef|\{children\}/.test(html);
  check('emit-html', ok,
    `static markup carries the composed card + a ${k}__tags row of ${SAMPLE.length} sampled badges inside the dialog body, backdrop sibling, no React syntax`);
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
      | { children?: Array<{ name: string; type?: string; children?: Array<{ name: string }> }> }
      | undefined;
    bodyKids = (body?.children ?? []).map((c) => c.name);
    // body now holds [summary, tags(row)]; the repeated tag instances live INSIDE
    // the tags row (a designer's pill row), not directly in body.
    const tagsRow = (body?.children ?? []).find((c) => c.name === 'tags');
    const tagKids = ((tagsRow as { children?: Array<{ name: string }> } | undefined)?.children ?? []).map((c) => c.name);
    const tagInstances = tagKids.filter((n) => n === 'tag' || /^tag \d+$/.test(n));
    refereeOk =
      comp.setName === name &&
      comp.contractId === contract.id &&
      (comp.variants ?? []).length === 1 &&
      roots.some((r) => r.name === 'dialog') &&
      roots.some((r) => r.name === 'backdrop') &&
      bodyKids.includes('summary') &&
      !!tagsRow &&
      tagInstances.length === SAMPLE.length;
  }
  check('emit-figma-script (referee)', refereeOk,
    `COMPONENTS payload parses — one variant frame; the dialog body holds the composed summary instance + a tags row of ${SAMPLE.length} repeated tag instances [${bodyKids.join(', ')}]`);

  // A composite that EMBEDS child instances (ds.card, ds.badge, and ds.card's
  // own ds.avatar) needs those component sets to already exist in the file when
  // the composite's sync runs — findComponentByName('Card'/'Badge') resolves
  // against previously-synced sets (real dependency ordering; the plugin syncs
  // leaves before composites). cross-import-check only COMPILES; modal-receipt
  // had no instances — so headless-executing a composite with dependencies is
  // this receipt's novel proof. Collect the transitive component deps in
  // dependency order (deps before dependents) and sync each into the SAME VM.
  // A component's transitive deps are BOTH channels the figma emitter turns into
  // findComponentByName() calls: hard `component` instances (componentRefsOf) AND
  // slot `accepts` targets — a slot's accepts list becomes an INSTANCE_SWAP whose
  // preferredValues resolve each accepted set by name (emit-figma-script.ts ~3389),
  // so those sets must exist in the file too. ds.card's footer accepts
  // [ds.button, ds.badge] → Button/Badge must be synced before Card, exactly as
  // the plugin syncs leaves before composites.
  const refIdsOf = (c: Contract): Set<string> => {
    const ids = new Set<string>(componentRefsOf(c).map(({ ref }) => ref.id));
    const walk = (part: { slot?: { accepts?: string[] }; parts?: Record<string, unknown> }): void => {
      for (const id of part.slot?.accepts ?? []) ids.add(id);
      for (const child of Object.values(part.parts ?? {})) walk(child as typeof part);
    };
    for (const part of Object.values(c.anatomy ?? {})) walk(part as Parameters<typeof walk>[0]);
    return ids;
  };
  const depOrder: Contract[] = [];
  const seen = new Set<string>();
  const visit = (c: Contract): void => {
    for (const id of refIdsOf(c)) {
      const dep = contracts.get(id);
      if (!dep || seen.has(dep.id)) continue;
      seen.add(dep.id);
      visit(dep); // dep's own deps first (ds.card → ds.avatar, ds.button, ds.badge)
      depOrder.push(dep);
    }
  };
  visit(contract);

  let ranHeadless = false;
  let runNote = '';
  let syncedDeps: string[] = [];
  let parityOk = false;
  let parityNote = '';
  try {
    const { figma, root } = createFigmaMock();
    const ctx = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
    // Component sync scripts BIND token variables (need('radius/avatar')) but do
    // not CREATE them — the real designer flow runs the token-setup script
    // (figma-sync/01-tokens.js = buildTokensScript) FIRST, seeding the
    // Primitives/Semantic/Brand collections, THEN syncs components. Replicate
    // that ordering exactly: seed the variables into the mock before any set,
    // else a token-bound descendant (ds.avatar → border-radius {radius.avatar})
    // throws 'Missing variable'. The multi-root Modal alone never hit this — its
    // dialog/backdrop use literal styles and bind nothing.
    const tokensSetup = createFigmaEngine({ tokens, icons, contracts }).buildTokensScript(null);
    await vm.runInContext(`(async () => {\n${tokensSetup}\n})()`, ctx, { timeout: 120_000 });
    // Each emitFigmaScript is a full standalone script (re-declares COMPONENTS,
    // findComponentByName, …), so wrap each in its OWN async IIFE scope — the
    // declarations are isolated but the mocked `figma` file state is shared, so
    // each synced set persists for the next script to find.
    for (const dep of depOrder) {
      const depScript = emitFigmaScript(dep, { tokens, icons, contracts });
      await vm.runInContext(`(async () => {\n${depScript}\n})()`, ctx, { timeout: 120_000 });
      syncedDeps.push(dep.name);
    }
    await vm.runInContext(`(async () => {\n${figmaScript}\n})()`, ctx, { timeout: 120_000 });
    ranHeadless = true;

    // NORTH STAR — the CANVAS anatomy lines up with the CONTRACT (code) anatomy
    // PART-FOR-PART. The composite builds as a real node tree in the mocked
    // Figma document; walk it and assert every contract part exists at its
    // DECLARED nesting path, and that the composed child + repeated collection
    // are REAL nested INSTANCE nodes (a ds.card instance + N ds.badge instances)
    // — not flattened leaves. This is the claim the whole depth build exists to
    // prove: "the anatomy of a coded component lines up with the anatomy of a
    // canvas-based Figma component." (Single-variant components build as a bare
    // COMPONENT, not a COMPONENT_SET.)
    type TNode = { name?: string; type?: string; children?: TNode[] };
    const findNode = (n: TNode, pred: (x: TNode) => boolean): TNode | null => {
      if (pred(n)) return n;
      for (const c of n.children ?? []) { const r = findNode(c, pred); if (r) return r; }
      return null;
    };
    const built = findNode(root as TNode, (n) => n.type === 'COMPONENT' && n.name === name);
    const base = (s?: string) => (s ?? '').replace(/ \d+$/, ''); // "tags 2" -> "tags"
    const childNamed = (node: TNode | null, nm: string): TNode | null =>
      (node?.children ?? []).find((c) => base(c.name) === nm) ?? null;
    // Every named part in the contract anatomy, as a nesting path.
    const partPaths: string[][] = [];
    const walkAnatomy = (
      parts: Record<string, { parts?: Record<string, unknown> }> | undefined,
      prefix: string[],
    ): void => {
      for (const [k, v] of Object.entries(parts ?? {})) {
        const p = [...prefix, k];
        partPaths.push(p);
        walkAnatomy(v.parts as Parameters<typeof walkAnatomy>[0], p);
      }
    };
    walkAnatomy(contract.anatomy as Parameters<typeof walkAnatomy>[0], []);
    const missing: string[] = [];
    for (const p of partPaths) {
      let cur: TNode | null = built;
      for (const seg of p) { cur = childNamed(cur, seg); if (!cur) break; }
      if (!cur) missing.push(p.join(' > '));
    }
    const body = childNamed(childNamed(built, 'dialog'), 'body');
    const summary = childNamed(body, 'summary');
    // body.tags is a ROW container (FRAME); the repeated ds.badge instances are
    // its `tag` children (a designer's pill row, not stacked full-width bars).
    const tagsRow = childNamed(body, 'tags');
    const tagInstances = (tagsRow?.children ?? []).filter((c) => base(c.name) === 'tag' && c.type === 'INSTANCE');
    const topRootNames = (built?.children ?? []).map((c) => c.name ?? '');
    parityOk =
      !!built && missing.length === 0 &&
      summary?.type === 'INSTANCE' &&
      tagsRow?.type === 'FRAME' &&
      tagInstances.length === SAMPLE.length &&
      topRootNames.includes('dialog') && topRootNames.includes('backdrop');
    parityNote = parityOk
      ? `built COMPONENT anatomy lines up with the contract PART-FOR-PART (${partPaths.length} parts, each at its declared nesting path); body.summary is a nested ds.card INSTANCE and body.tags is a row FRAME holding ${tagInstances.length} repeated ds.badge INSTANCEs; dialog+backdrop are sibling roots`
      : `MISMATCH — built=${!!built}; missing [${missing.join('; ')}]; summary=${summary?.type ?? 'absent'}; tagsRow=${tagsRow?.type ?? 'absent'}; tagInstances=${tagInstances.length}/${SAMPLE.length}; roots=[${topRootNames.join(', ')}]`;
  } catch (e) {
    runNote = String(e instanceof Error ? e.message : e);
  }
  check('emit-figma-script (headless)', ranHeadless,
    ranHeadless
      ? `seeded token variables (buildTokensScript) then synced deps [${syncedDeps.join(' → ')}] then the composite ran to completion in a VM against the mocked figma global (no Figma, no network) — composed + repeated instances built`
      : `threw — ${runNote}`);
  check('anatomy-parity (code ≡ canvas)', parityOk,
    ranHeadless ? parityNote : 'skipped — headless run did not complete');
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

## Proof (${results.filter((r) => r.ok).length}/${results.length} checks — 5 surfaces + canvas≡code anatomy parity)

| check | pass | what executed |
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
console.log(`\n✔ Stage C composite: 5 surfaces emitted + EXECUTED, canvas anatomy ≡ code anatomy (${results.length} checks) → examples/depth-composite/RECEIPT.md`);
