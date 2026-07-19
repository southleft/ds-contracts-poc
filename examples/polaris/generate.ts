/**
 * Polaris showcase generation — committed contracts → every code surface +
 * the Figma sync scripts. Deterministic by construction; `--check` re-emits
 * everything in memory and FAILS on any byte drift from the committed
 * artifacts (the polaris-showcase-reproducible eval runs exactly that).
 *
 *   npx tsx examples/polaris/generate.ts            # write artifacts
 *   npx tsx examples/polaris/generate.ts --check    # byte-stability + summary check
 *
 * Outputs:
 *   generated/react/<Name>.{tsx,module.css,stories.tsx}   (emitReact — the shipping generator)
 *   generated/html/<kebab>.{html,css}                     (emitHtml — static, no build step)
 *   generated/html/polaris-tokens.css                     (the wrapped Polaris token set as :root custom properties)
 *   figma/<kebab>.figma.js                                (emitFigmaScript — referee-gated)
 *   figma/00-tokens.figma.js                              (variable upsert script for a blank file)
 *   figma/COMPILE-RECEIPT.md                              (headless canvas-engine compile receipt)
 *
 * No Polaris clone required: this step runs from the COMMITTED contracts +
 * COMMITTED token wrap alone (that is the point of a contract).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { emitHtml, emitReact } from '../../core/index.js';
import { createFigmaEngine, emitFigmaScript } from '../../core/emit-figma-script.js';

import { aliasTarget, flattenTokens, tokenInventoryFromJson, type TokenTreeInput } from '../../core/tokens.js';
import { kebab } from '../../extract/types.js';

const EXAMPLE = path.resolve(new URL('.', import.meta.url).pathname);
const CHECK = process.argv.includes('--check');

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;

const tokensTree = readJson(path.join(EXAMPLE, 'tokens', 'polaris-light.dtcg.json'));

/** The canvas engine computes in px (Figma's unit). Polaris publishes rem
 *  dimensions on its own documented 1rem = 16px base — the conversion is
 *  mechanical and applies ONLY to the tree handed to the Figma engine; the
 *  committed DTCG wrap and both code surfaces keep the rem values verbatim. */
const remToPx = (node: unknown): unknown => {
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === '$value' && typeof v === 'string' && /^-?\d*\.?\d+rem$/.test(v.trim())) {
      out[k] = `${parseFloat(v) * 16}px`;
    } else out[k] = remToPx(v);
  }
  return out;
};

/** In-set DTCG aliases resolved to their target literals — the Figma
 *  variable upsert models the flat foreign set as a literal-valued
 *  Primitives collection (the repo's alias-wired Semantic collection is a
 *  4-tree-layout feature; a NAMED BYO limit, see COMPILE-RECEIPT.md). */
const resolveAliases = (tree: Record<string, unknown>): Record<string, unknown> => {
  const flat = flattenTokens(tree);
  const resolve = (v: unknown, depth = 0): unknown => {
    const target = aliasTarget(v);
    if (!target || depth > 10) return v;
    return resolve(flat.get(target)?.value, depth + 1);
  };
  const walk = (node: unknown): unknown => {
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = k === '$value' ? resolve(v) : walk(v);
    }
    return out;
  };
  return walk(tree) as Record<string, unknown>;
};

/** Figma variables carry COLOR / FLOAT / STRING(font family) — a foreign
 *  set's gradients, shadows, font stacks, easing curves and keyframe names
 *  have no variable representation. Those leaves are EXCLUDED from the
 *  variable upsert BY NAME (listed in COMPILE-RECEIPT.md); they remain in
 *  the committed DTCG wrap and the CSS custom-property stylesheet. */
const variableRepresentable = (entry: { value: unknown; type: string }): boolean => {
  const v = String(entry.value);
  if (entry.type === 'color') return /^#|^rgba?\(|^hsla?\(/.test(v);
  return /^-?\d*\.?\d+(px|ms|s)?$/.test(v.trim());
};
const excludedFromVariables: string[] = [];
const filterRepresentable = (tree: Record<string, unknown>): Record<string, unknown> => {
  const flat = flattenTokens(tree);
  const out: Record<string, unknown> = {};
  for (const [p, entry] of flat) {
    if (!variableRepresentable(entry)) {
      excludedFromVariables.push(`\`${p}\` = \`${String(entry.value)}\``);
      continue;
    }
    const segs = p.split('.');
    let node = out;
    for (const seg of segs.slice(0, -1)) node = (node[seg] ??= {}) as Record<string, unknown>;
    node[segs[segs.length - 1]] = { $value: entry.value, ...(entry.type ? { $type: entry.type } : {}) };
  }
  return out;
};

const figmaTree = filterRepresentable(
  resolveAliases(remToPx(tokensTree) as Record<string, unknown>) as Record<string, unknown>,
);
// The ENGINE tree keeps every token (component compile resolves shadows,
// gradients, etc. to literals); the VARIABLE-UPSERT tree is the filtered
// representable subset. Both ride the `primitives` slot: a flat, literal-
// valued foreign set maps to the Primitives collection (mode "Value"). The
// 4-tree corpus layout is the repo's own — a NAMED BYO limit from the
// enterprise gauntlet, unchanged here.
const engineTree = resolveAliases(remToPx(tokensTree) as Record<string, unknown>) as Record<string, unknown>;
const emptyTrees = { semantic: {}, light: {}, dark: {}, brands: { default: {} } };
const trees: TokenTreeInput = { primitives: engineTree, ...emptyTrees };
const upsertTrees: TokenTreeInput = { primitives: figmaTree, ...emptyTrees };
const inventory = tokenInventoryFromJson([tokensTree]);
const icons = new Map<string, string>(
  readdirSync(path.join(EXAMPLE, 'assets', 'icons'))
    .filter((f) => f.endsWith('.svg'))
    .sort()
    .map((f) => [f.replace(/\.svg$/, ''), readFileSync(path.join(EXAMPLE, 'assets', 'icons', f), 'utf8').trim()]),
);

const contracts = readdirSync(path.join(EXAMPLE, 'contracts'))
  .filter((f) => f.endsWith('.contract.json'))
  .sort()
  .map((f) => ContractSchema.parse(readJson(path.join(EXAMPLE, 'contracts', f))));
const byId = new Map<string, Contract>(contracts.map((c) => [c.id, c]));

interface OutFile {
  path: string; // relative to examples/polaris/
  contents: string;
}
const files: OutFile[] = [];

// ---------------------------------------------------------------------------
// React + HTML surfaces
// ---------------------------------------------------------------------------
for (const c of contracts) {
  const react = emitReact(c, { tokens: inventory, icons, contracts: byId });
  files.push(
    { path: `generated/react/${c.name}.tsx`, contents: react.tsx },
    { path: `generated/react/${c.name}.module.css`, contents: react.css },
    { path: `generated/react/${c.name}.stories.tsx`, contents: react.stories },
  );
  const html = emitHtml(c, { tokens: inventory, icons, contracts: byId });
  files.push(
    { path: `generated/html/${kebab(c.name)}.html`, contents: html.html },
    { path: `generated/html/${kebab(c.name)}.css`, contents: html.css },
  );
}

// The wrapped Polaris tokens as :root custom properties — the stylesheet the
// static HTML surface resolves its var(--p-*) references through. Values are
// VERBATIM from tokens/polaris-light.dtcg.json (MIT © Shopify, attributed);
// DTCG aliases print back as the var() references Polaris itself publishes.
{
  const flat = flattenTokens(tokensTree as Record<string, unknown>);
  const lines = [':root {'];
  for (const [p, entry] of flat) {
    const alias = aliasTarget(entry.value);
    const value = alias ? `var(--${alias.split('.').join('-')})` : String(entry.value);
    lines.push(`  --${p.split('.').join('-')}: ${value};`);
  }
  lines.push('}');
  files.push({
    path: 'generated/html/polaris-tokens.css',
    contents:
      '/* Polaris (light/base theme) tokens as custom properties — mechanically wrapped from\n' +
      ' * @shopify/polaris-tokens at the pinned SHA (MIT © Shopify). Values verbatim;\n' +
      ' * DTCG aliases printed back as the var() references Polaris publishes. */\n' +
      lines.join('\n') +
      '\n',
  });
}

// ---------------------------------------------------------------------------
// Figma sync scripts: referee-gated emission + headless canvas-engine compile
// ---------------------------------------------------------------------------
const engine = createFigmaEngine({ tokens: trees, icons });
const receipt: string[] = [
  '# Figma script compile receipt (headless)',
  '',
  'Every committed `figma/*.figma.js` passed BOTH gates at generation time:',
  '',
  '1. **Referee** — `emitFigmaScript` refuses any contract violating the shared',
  '   `validateContract` rules (same referee as the React generator); an emitted',
  '   script is proof of a clean pass.',
  '2. **Canvas-engine compile** — `createFigmaEngine().compileComponentData` (the',
  '   exact compile step the sync script serializes, and the same engine the',
  '   playground canvas preview renders) compiled every variant combination',
  '   headlessly. Per-contract counts below.',
  '',
  '| contract | variants compiled | variant axes | distinct bound variable names | script committed |',
  '|---|---|---|---|---|',
];
/** A Figma component set beyond this many variants is not a buildable
 *  artifact (Figma's own practical limits; 10-20MB scripts): the script
 *  still COMPILES headlessly — that is the verified claim — but it is not
 *  committed and not queued for Phase B. Named per contract below. */
const VARIANT_COMMIT_LIMIT = 500;
const explosions: string[] = [];
for (const c of contracts) {
  const script = emitFigmaScript(c, { tokens: trees, icons, contracts: byId });
  const data = engine.compileComponentData(c, byId);
  const variants = (data as { variants: unknown[] }).variants;
  const axes = c.props.filter((p) => typeof p.type === 'object' && 'enum' in p.type).length;
  const boundRefs = new Set(script.match(/"p\/[A-Za-z0-9/-]+"/g) ?? []).size;
  const committed = variants.length <= VARIANT_COMMIT_LIMIT;
  if (committed) {
    files.push({ path: `figma/${kebab(c.name)}.figma.js`, contents: script });
  } else {
    explosions.push(
      `- \`${c.id}\`: ${variants.length} variants (${axes} enum axes, full cartesian) — the script compiles ` +
        `headlessly and passed the referee, but a component set that size is not a buildable canvas artifact ` +
        `(and the ${(script.length / 1024 / 1024).toFixed(1)}MB script is not committed). Canvas modeling for this ` +
        `component needs AXIS CURATION (which axes become Figma variants vs. text-style/property choices) — ` +
        `a named Phase B owner decision, and a real finding: the canvas engine compiles the full cartesian by design.`,
    );
  }
  receipt.push(
    `| \`${c.id}\` | ${variants.length} | ${axes} | ${boundRefs} | ${committed ? 'yes' : 'NO — variant explosion (see below)'} |`,
  );
}
if (explosions.length > 0) {
  receipt.push('', '## Variant-explosion exclusions (compiled, verified, NOT committed)', '', ...explosions);
}
receipt.push(
  '',
  '## Token variable upsert — named BYO limits',
  '',
  'The wrapped Polaris set upserts as a literal-valued **Primitives** collection',
  '(mode "Value"). Two mechanical, NAMED transformations apply only to the Figma',
  'side (the committed DTCG wrap and both code surfaces keep values verbatim):',
  '',
  '- rem dimensions convert at Polaris\'s own documented 1rem = 16px base',
  '- in-set aliases flatten to their resolved values (alias-wired variables are a',
  '  feature of the repo\'s 4-tree layout, not of a flat foreign set)',
  '',
  `${excludedFromVariables.length} token(s) have NO Figma-variable representation (gradients, shadows,`,
  'font stacks, easing curves, keyframe names, media strings) and are excluded from',
  'the upsert by name:',
  '',
  ...excludedFromVariables.map((l) => `- ${l}`),
  '',
  'The token script (`00-tokens.figma.js`) upserts the wrapped Polaris token set as',
  'Figma variables (collection per tree; values verbatim) so the component scripts\'',
  'variable lookups resolve in a BLANK file — Phase B runs the token script first,',
  'then any component script, in any order.',
  '',
);
files.push({ path: 'figma/00-tokens.figma.js', contents: createFigmaEngine({ tokens: upsertTrees, icons }).buildTokensScript(null) });
files.push({ path: 'figma/COMPILE-RECEIPT.md', contents: receipt.join('\n') + '\n' });

// ---------------------------------------------------------------------------
// Write or check
// ---------------------------------------------------------------------------
if (!CHECK) {
  for (const f of files) {
    const abs = path.join(EXAMPLE, f.path);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, f.contents);
  }
  console.log(`✔ ${files.length} generated file(s) written under examples/polaris/`);
} else {
  const drift: string[] = [];
  for (const f of files) {
    const abs = path.join(EXAMPLE, f.path);
    let committed: string | null = null;
    try {
      committed = readFileSync(abs, 'utf8');
    } catch {
      committed = null;
    }
    if (committed === null) drift.push(`${f.path}: MISSING from the committed tree`);
    else if (committed !== f.contents) drift.push(`${f.path}: regenerated bytes differ from the committed file`);
  }
  // Truth-table consistency: the numbers SHOWCASE.md quotes are generated
  // from receipts/truth-table.json — the quoted block must match a
  // re-derivation, so prose can never drift from the measured data.
  const ttPath = path.join(EXAMPLE, 'receipts', 'truth-table.json');
  const showcasePath = path.join(EXAMPLE, 'SHOWCASE.md');
  try {
    const tt = JSON.parse(readFileSync(ttPath, 'utf8')) as {
      components: { id: string; combos: number; rowsCompared: number; rowsMatched: number; namedNotCarried: number }[];
    };
    const lines = tt.components.map(
      (c) => `| \`${c.id}\` | ${c.combos} | ${c.rowsCompared} | ${c.rowsMatched} | ${c.namedNotCarried} |`,
    );
    const showcase = readFileSync(showcasePath, 'utf8');
    for (const line of lines) {
      if (!showcase.includes(line)) drift.push(`SHOWCASE.md: truth-table row missing or stale: ${line}`);
    }
  } catch (e) {
    drift.push(`truth-table consistency check failed to run: ${(e as Error).message}`);
  }
  if (drift.length > 0) {
    console.error(`✖ polaris showcase drift (${drift.length}):`);
    for (const d of drift) console.error(`  - ${d}`);
    process.exit(1);
  }
  console.log(`✔ ${files.length} generated file(s) byte-stable; SHOWCASE.md truth-table rows match receipts/truth-table.json`);
}
