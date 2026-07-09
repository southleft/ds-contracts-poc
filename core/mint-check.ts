/**
 * Receipts for provisional token minting — `npm run mint:check`.
 *
 * A synthetic dump (a set no real canvas produced, so every styled fact is a
 * resolved literal — the exact shape of a variables-endpoint-degraded REST
 * import) exercises the two minting rules the Badge receipt can't:
 *
 *   1. DEDUPE     the same literal at ≥3 usage sites collapses into ONE
 *                 `imported.shared.*` leaf, and every site binds it.
 *   2. VARIANTS   per-axis values mint per-variant leaves + the substituted
 *                 ref; values that do NOT correlate with any axis mint
 *                 NOTHING (the drift stays a named review item).
 *
 * Plus the invariants every mint must hold: default-off back-compat, zero
 * names outside the `imported.` namespace, deterministic output, and the
 * proposal generating green through emitReact AND emitHtml with an inventory
 * built from the repo trees + the minted tree.
 *
 * Node script over pure functions (core/mint-tokens.ts, core/propose-figma.ts)
 * — the same shell/core split as every other check in the repo.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../scripts/contract-schema.js';
import type { DumpNode, DumpSet } from '../extract/figma/types.js';
import { loadTokenCorpus } from '../extract/figma/tokens.js';
import { proposeFromDump } from './propose-figma.js';
import { MINT_NAMESPACE, mintedTokenCss } from './mint-tokens.js';
import { emitReact } from './emit-react.js';
import { emitHtml } from './emit-html.js';
import { tokenInventoryFromJson } from './tokens.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

// ---------------------------------------------------------------------------
// Synthetic degraded dump: Tone×Size axes, every styled fact a raw literal
// ---------------------------------------------------------------------------

/** One variant's tree. Root fill varies by Tone (axis-correlated); part `d`'s
 *  fill varies by BOTH axes (uncorrelated); a/b/c repeat #333333 and radius 4
 *  (dedupe); the label's 13px has no derived-style match (font-size mint). */
function variant(tone: 'Neutral' | 'Accent', size: 'Sm' | 'Md'): DumpNode {
  const rootFill = tone === 'Neutral' ? 'eeeeee' : '112233';
  const dFill = { 'Neutral Sm': '010101', 'Neutral Md': '020202', 'Accent Sm': '030303', 'Accent Md': '040404' }[
    `${tone} ${size}`
  ]!;
  const box = (name: string): DumpNode => ({ name, type: 'FRAME', fill: { hex: '333333' }, cornerRadius: 4 });
  return {
    name: `Tone=${tone}, Size=${size}`,
    type: 'COMPONENT',
    layout: {
      mode: 'HORIZONTAL',
      primary: 'CENTER',
      counter: 'CENTER',
      spacing: 8,
      padding: [4, 12, 4, 12],
      primarySizing: 'AUTO',
      counterSizing: 'AUTO',
    },
    cornerRadius: 4,
    fill: { hex: rootFill },
    children: [
      box('a'),
      box('b'),
      box('c'),
      { name: 'd', type: 'FRAME', fill: { hex: dFill } },
      {
        name: 'label',
        type: 'TEXT',
        fill: { hex: '101010' },
        text: { characters: 'Sample', fontSize: 13, fontStyle: 'Medium' },
      },
    ],
  };
}

const set: DumpSet = {
  setName: 'Sample',
  type: 'COMPONENT_SET',
  variants: [variant('Neutral', 'Sm'), variant('Neutral', 'Md'), variant('Accent', 'Sm'), variant('Accent', 'Md')],
};

const corpus = loadTokenCorpus(ROOT);
const opts = { corpus, contractIdByName: new Map<string, string>(), fileKey: null };

// ---------------------------------------------------------------------------
// Back-compat: minting is opt-in
// ---------------------------------------------------------------------------

console.log('\nBack-compat (mintUnbound off)');
const plain = proposeFromDump(set, opts);
check('no mintedTokens on the result', plain.mintedTokens === undefined);
check('unbound literals stay report entries', plain.unbound.length >= 9);
check('no imported.* ref anywhere', !JSON.stringify(plain.contract).includes(`{${MINT_NAMESPACE}.`));

// ---------------------------------------------------------------------------
// Minted proposal
// ---------------------------------------------------------------------------

console.log('\nMinting (mintUnbound on)');
const minted = proposeFromDump(set, { ...opts, mintUnbound: true });
const m = minted.mintedTokens;
check('mintedTokens returned', m !== undefined);
const entries = m?.entries ?? [];
const byRef = new Map(entries.map((e) => [e.ref, e]));

// 1. Dedupe: #333333 at three sites → ONE shared color leaf, bound at all three.
const sharedColor = byRef.get('{imported.shared.color-333333}');
check('dedupe: #333333 ×3 sites → imported.shared.color-333333', sharedColor?.value === '#333333');
check('dedupe: the shared color leaf lists all 3 usage sites', (sharedColor?.usageSites.length ?? 0) === 3);
const parts = ((minted.contract.anatomy as Record<string, any>).root as any).parts as Record<string, any>;
check(
  'dedupe: a, b, c all bind the shared color leaf',
  ['a', 'b', 'c'].every((n) => parts[n]?.tokens?.['background-color'] === '{imported.shared.color-333333}'),
);
// Radius 4 rides root+a+b+c and padding-block 4 — five sites, one shared leaf.
const sharedSize = byRef.get('{imported.shared.size-4}');
check('dedupe: 4px ×5 sites (radii + padding-block) → imported.shared.size-4', sharedSize?.value === '4px');
check('dedupe: the shared size leaf lists 5 usage sites', (sharedSize?.usageSites.length ?? 0) === 5);

// 2. Per-variant: root fill correlates with Tone → substituted ref + a leaf
//    per axis value; part d's fill correlates with NOTHING → no mint, named.
const rootTokens = ((minted.contract.anatomy as Record<string, any>).root as any).tokens as Record<string, string>;
check(
  'variants: root background-color is the substituted ref {imported.sample.root.background-color.{tone}}',
  rootTokens['background-color'] === '{imported.sample.root.background-color.{tone}}',
);
check(
  'variants: a leaf per axis value with the right literals',
  byRef.get('{imported.sample.root.background-color.neutral}')?.value === '#eeeeee' &&
    byRef.get('{imported.sample.root.background-color.accent}')?.value === '#112233',
);
check('variants: uncorrelated d fill minted NOTHING', parts.d?.tokens === undefined);
check(
  'variants: the uncorrelated drift is a named review item',
  minted.notes.some((n) => n.includes('Sample:root/d') && n.includes('without correlating to any variant axis')),
);
check(
  'variants: d fill survives as the one remaining UNBOUND entry',
  minted.unbound.length === 1 && minted.unbound[0].nodePath === 'Sample:root/d' && minted.unbound[0].property === 'fill',
);

// 3. Units + the remaining site-named leaves.
check('gap minted with px units', byRef.get('{imported.sample.root.gap}')?.value === '8px');
check('padding-inline minted with px units', byRef.get('{imported.sample.root.padding-inline}')?.value === '12px');
check('text color minted by usage site', byRef.get('{imported.sample.label.color}')?.value === '#101010');
check('font-size minted when no derived style matches', byRef.get('{imported.sample.label.font-size}')?.value === '13px');

// 4. Naming discipline: mechanical, provisional, never semantic.
check('every minted ref lives under the imported. namespace', entries.every((e) => e.ref.startsWith(`{${MINT_NAMESPACE}.`)));
check(
  'every minted ref lands in notes as provisional',
  entries.every((e) => minted.notes.some((n) => n.includes(e.ref) && n.includes('rename against your real tokens (provisional)'))),
);

// 5. Determinism: same dump, same tree, byte for byte.
const again = proposeFromDump(set, { ...opts, mintUnbound: true });
check('minting is deterministic', JSON.stringify(again.mintedTokens) === JSON.stringify(m));

// 6. The proposal validates and GENERATES: emitReact + emitHtml run green with
//    an inventory of repo trees + the minted tree (multiple-tree inventory).
const contract: Contract = ContractSchema.parse(minted.contract);
const inventory = tokenInventoryFromJson([
  read('tokens/primitives.tokens.json'),
  read('tokens/semantic.tokens.json'),
  read('tokens/modes/semantic.light.tokens.json'),
  read('tokens/modes/semantic.dark.tokens.json'),
  m?.tree ?? {},
]);
const emitCtx = { tokens: inventory, icons: new Map<string, string>(), contracts: new Map([[contract.id, contract]]) };
let reactOk = true;
let htmlCss = '';
try {
  emitReact(contract, emitCtx);
  htmlCss = emitHtml(contract, emitCtx).css;
} catch (e) {
  reactOk = false;
  console.error(String(e));
}
check('emitReact + emitHtml run green with repo + minted trees', reactOk);
check(
  'emitted css references the minted custom properties',
  htmlCss.includes('var(--imported-shared-color-333333)') &&
    htmlCss.includes('var(--imported-sample-root-background-color-neutral)'),
);
const cssVars = mintedTokenCss(m?.tree ?? {});
check(
  'mintedTokenCss carries every literal the bindings resolve to',
  entries.every((e) => cssVars.includes(`--${e.ref.slice(1, -1).split('.').join('-')}: ${e.value};`)),
);

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} minting invariant(s) failed`);
  process.exit(1);
}
console.log('\n✔ all minting invariants hold (dedupe, per-variant, refusal, determinism, generation)');
