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
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { emitHtml, emitReact } from '../../core/index.js';
import { createFigmaEngine, emitFigmaScript } from '../../core/emit-figma-script.js';
import { mintedTokenCss } from '../../core/mint-tokens.js';

import { aliasTarget, flattenTokens, tokenInventoryFromJson, type TokenTreeInput } from '../../core/tokens.js';
import { kebab } from '../../extract/types.js';

const EXAMPLE = path.resolve(new URL('.', import.meta.url).pathname);
const CHECK = process.argv.includes('--check');

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;

const tokensTree = readJson(path.join(EXAMPLE, 'tokens', 'polaris-light.dtcg.json'));

/** Minted provisional tokens from the computed-floor promotion (round 2):
 *  `imported.*` leaves minted by extract/computed for styled channels with
 *  no recoverable Polaris token name (see scripts/promote-floor.ts). The
 *  v0.2.0 contracts reference them; absent file (pre-promotion tree) → empty
 *  layer, byte-identical output. */
const mintedPath = path.join(EXAMPLE, 'tokens', 'polaris-minted.dtcg.json');
const mintedTree = existsSync(mintedPath) ? readJson(mintedPath) : {};
const hasMinted = Object.keys(mintedTree).length > 0;

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
// The minted `imported.*` layer rides the semantic slot for the canvas
// engine (the playground token-source pattern: the MINT_NAMESPACE root never
// collides with a real semantic group). Minted values are browser-computed
// px/hex literals — no rem conversion applies.
// Polaris type scale → MINTED FIGMA TEXT STYLES (owner ruling, round 2).
// Mechanical derivation from the wrapped token set's own names: every
// `p.text-<role>-font-size` mints one semantic `font.<role>.size` ALIAS (plus
// `font.<role>.weight` when Polaris publishes one) — the existing text-style
// machinery derives one named Figma text style per role from exactly this
// shape (identity marker ds_contracts/textStyleToken = font.<role>.size),
// upserted by 00-tokens.figma.js. NAMED LIMITS: (1) sample text cells keep
// raw font props — style ATTACHMENT is an exact identity match on the node's
// bound token path, and the floor-promoted contracts bind Polaris's own
// primitives (p.text-*), which is the honest binding; (2) Polaris's 450/550/
// 650 weights have no Inter style mapping in the shared weight table, so the
// styles carry the 'Medium' runtime fallback (quoted in the receipt).
const textStyleTree = (() => {
  const flat = flattenTokens(tokensTree);
  const roles: Array<[string, { sizePath: string; weightPath?: string }]> = [];
  for (const [p] of flat) {
    const m = /^p\.text-(.+)-font-size$/.exec(p);
    if (!m) continue;
    const weightPath = `p.text-${m[1]}-font-weight`;
    roles.push([m[1], { sizePath: p, ...(flat.has(weightPath) ? { weightPath } : {}) }]);
  }
  roles.sort((a, b) => a[0].localeCompare(b[0]));
  const font: Record<string, unknown> = {};
  for (const [role, r] of roles) {
    font[role] = {
      size: { $value: `{${r.sizePath}}`, $type: 'dimension' },
      ...(r.weightPath ? { weight: { $value: `{${r.weightPath}}`, $type: 'number' } } : {}),
    };
  }
  return roles.length > 0 ? { font } : {};
})();
const textStyleRoles = Object.keys((textStyleTree as { font?: Record<string, unknown> }).font ?? {});

const trees: TokenTreeInput = { primitives: engineTree, ...emptyTrees, ...(hasMinted ? { semantic: mintedTree } : {}) };
const upsertTrees: TokenTreeInput = { primitives: figmaTree, ...emptyTrees, semantic: textStyleTree };
const inventory = tokenInventoryFromJson([tokensTree, ...(hasMinted ? [mintedTree] : [])]);
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

// ---------------------------------------------------------------------------
// Canvas axis curation (owner ruling, floor round 2). The CONTRACT keeps the
// full prop space — these projections shape ONLY the emitted Figma scripts
// (the canvas is a curated visual reference, not the API): enum axes that do
// not change visual form a designer picks per instance are pinned to a
// single representative value, and oversized designer-facing axes draw a
// named SUBSET. Booleans are already BOOLEAN properties (never variant
// axes); the code surfaces and the truth gates always run the full space.
// ---------------------------------------------------------------------------
interface CanvasProjection {
  /** enum prop → kept values ('*' = all). Unlisted enum props keep all. */
  keep: Record<string, string[] | '*'>;
  note: string;
}
const CANVAS_PROJECTIONS: Record<string, CanvasProjection> = {
  'polaris.text': {
    keep: {
      variant: '*',
      tone: ['base', 'success', 'critical', 'caution', 'subdued'],
      fontWeight: ['regular'],
      alignment: ['start'],
      as: ['p'],
    },
    note:
      'CANVAS PROJECTION (named curation): the drawn set is variant (all 11) × tone (5 of 11 — base, success, critical, ' +
      'caution, subdued) = 55 sample cells; fontWeight/alignment/as are pinned to one representative value each ' +
      '(regular/start/p — fontWeight and alignment restyle text a designer sets per instance, `as` is a semantics-only ' +
      'tag swap). The full 23,232-cell cartesian stays intact in the contract and both code surfaces; the Polaris type ' +
      'scale itself ships as MINTED FIGMA TEXT STYLES (see the token script receipt below).',
  },
  'polaris.text-field': {
    keep: {
      type: ['text'],
      inputMode: ['text'],
      align: ['left'],
      variant: '*',
      size: '*',
    },
    note:
      'CANVAS PROJECTION (named curation): the drawn set is variant (2) × size (2) = 4 cells; type/inputMode/align are ' +
      'pinned to one representative value each (text/text/left — they parameterize input behavior and text alignment, ' +
      'not component form). Booleans are BOOLEAN properties; disabled rides the state-preview vocabulary where the ' +
      'contract declares it. The full 1,344-cell cartesian stays intact in the contract and both code surfaces.',
  },
};

/** Apply a canvas projection to a CLONE: shrink enum value lists (the
 *  contract default always survives) and prune per-value maps to the kept
 *  values so the projected contract still passes the shared referee. */
function projectForCanvas(contract: Contract): { contract: Contract; projection?: CanvasProjection } {
  const projection = CANVAS_PROJECTIONS[contract.id];
  if (!projection) return { contract };
  const clone = structuredClone(contract);
  const keptByProp = new Map<string, Set<string>>();
  for (const p of clone.props) {
    if (typeof p.type !== 'object' || !('enum' in p.type)) continue;
    const keep = projection.keep[p.name];
    if (!keep || keep === '*') continue;
    const kept = [...keep];
    if (p.default !== undefined && !kept.includes(String(p.default))) kept.unshift(String(p.default));
    p.type.enum = p.type.enum.filter((v: string) => kept.includes(v));
    if (p.type.enum.length === 0) throw new Error(`${contract.id}: canvas projection empties enum "${p.name}"`);
    keptByProp.set(p.name, new Set(p.type.enum));
    if (p.bindings.figma.values) {
      p.bindings.figma.values = Object.fromEntries(
        Object.entries(p.bindings.figma.values).filter(([k]) => keptByProp.get(p.name)!.has(k)),
      );
    }
  }
  const pruneMaps = (part: Record<string, unknown>) => {
    for (const field of ['tokensByProp', 'literalsByProp', 'layoutByProp'] as const) {
      const entries = part[field];
      if (!Array.isArray(entries)) continue;
      for (const e of entries as Array<{ prop: string; map: Record<string, unknown> }>) {
        const kept = keptByProp.get(e.prop);
        if (!kept) continue;
        e.map = Object.fromEntries(Object.entries(e.map).filter(([k]) => kept.has(k)));
      }
    }
    for (const child of Object.values((part.parts as Record<string, Record<string, unknown>>) ?? {})) pruneMaps(child);
  };
  pruneMaps(clone.anatomy.root as unknown as Record<string, unknown>);
  ContractSchema.parse(clone);
  return { contract: clone, projection };
}

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

// Minted provisional tokens (computed-floor promotion) as custom properties —
// the second stylesheet the static HTML surface needs once v0.2.0 contracts
// reference `imported.*` bindings. Values are browser-computed literals.
if (hasMinted) {
  files.push({
    path: 'generated/html/polaris-minted-tokens.css',
    contents:
      '/* Minted provisional tokens (imported.*) — computed-floor capture of @shopify/polaris\n' +
      ' * (extract/computed; see tokens/polaris-minted.dtcg.json). Literal fidelity: values are\n' +
      ' * the browser\'s own computed results; no Polaris token name was recoverable for these\n' +
      ' * channels (every mint is receipted in the per-component LEDGER.md). */\n' +
      mintedTokenCss(mintedTree) +
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
const projectionNotes: string[] = [];
for (const c of contracts) {
  const { contract: canvasContract, projection } = projectForCanvas(c);
  const script = emitFigmaScript(canvasContract, { tokens: trees, icons, contracts: byId, ...(hasMinted ? { mintedTokens: mintedTree } : {}) });
  const data = engine.compileComponentData(canvasContract, byId);
  const variants = (data as { variants: unknown[] }).variants;
  const axes = canvasContract.props.filter((p) => typeof p.type === 'object' && 'enum' in p.type).length;
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
  if (projection) projectionNotes.push(`- \`${c.id}\`: ${projection.note}`);
  receipt.push(
    `| \`${c.id}\` | ${variants.length} | ${axes} | ${boundRefs} | ${committed ? (projection ? 'yes (canvas projection, see below)' : 'yes') : 'NO — variant explosion (see below)'} |`,
  );
}
if (explosions.length > 0) {
  receipt.push('', '## Variant-explosion exclusions (compiled, verified, NOT committed)', '', ...explosions);
}
if (projectionNotes.length > 0) {
  receipt.push(
    '',
    '## Canvas projections (owner ruling, floor round 2)',
    '',
    'The CONTRACT keeps the full prop space; the committed script draws a NAMED curated',
    'projection (generate.ts CANVAS_PROJECTIONS). Booleans are BOOLEAN properties (never',
    'variant axes); interaction states ride the State-preview axis where the contract',
    'declares them.',
    '',
    ...projectionNotes,
  );
}
if (textStyleRoles.length > 0) {
  receipt.push(
    '',
    '## Minted Figma text styles (Polaris type scale)',
    '',
    `\`00-tokens.figma.js\` upserts **${textStyleRoles.length} named text styles** — one per Polaris text role`,
    '(`p.text-<role>-font-size` → semantic `font.<role>.size` alias → text style with identity',
    'marker `ds_contracts/textStyleToken`, rename-safe, idempotent):',
    '',
    ...textStyleRoles.map((r) => `- \`${r}\``),
    '',
    'NAMED LIMITS: sample text cells keep raw font props — style attachment is an exact',
    'identity match on the node\'s bound token path, and the floor-promoted contracts bind',
    'Polaris\'s own primitives (`p.text-*`), which is the honest binding. Polaris\'s 450/550/650',
    'font weights have no Inter style mapping in the shared weight table, so minted styles',
    'carry the \'Medium\' runtime fallback.',
  );
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
