/**
 * Receipts for §3 — THEME/MODE-AXIS PROMOTION (P17, the mirror image of
 * interaction-state promotion). `npm run extract:figma:theme:check`.
 *
 * A drawn `Theme=Light|Dark` variant axis is NOT API — it is a token MODE
 * (DTCG modes / Figma variable-collection modes). Shipping `theme` as a
 * component prop is the same category error as shipping `state: 'hover'`;
 * Carbon, Material, and Fluent all model theme as token layers (the
 * enterprise gauntlet's corroboration input: Carbon's four themes are
 * identical 306-key token sets). Detection needs TWO signals — the bounded
 * name table AND structural corroboration (identical anatomy + identical
 * bound variable NAMES across the axis; only color-kind literals/resolved
 * values differ). Name alone is never enough (D4); near-misses are NAMED,
 * never guessed.
 *
 * The owner's v14 all-sets dump carries NO themed set (checked: zero axes
 * named theme|mode|scheme|appearance across 1,618 sets), so the fixture is
 * SYNTHETIC in the CBDS shape (bound variables with CBDS-style slash names,
 * axes theme × variant, dump v1.6 `_variables.modes`). Pinned:
 *
 *   1. Corroborated theme axis → NO theme prop; base facts from the LIGHT
 *      (default-mode) variants only; the promotion receipt note; contract
 *      `modes` metadata; referee clean, all four surfaces emit.
 *   2. MINT ISOLATION: the dark variants never feed the mint pass — the
 *      dark-side raw literal appears nowhere in the minted tokens.
 *   3. MODES RESOLVE: the captured-token layer (dump v1.6) carries per-mode
 *      trees — the dark tree resolves the bound variable to its dark value.
 *   4. Near-miss: theme-NAMED axis whose variants differ structurally →
 *      stays an enum prop + WARNING note (unify the drawn structure).
 *   5. Near-miss: theme-NAMED axis with a value outside the mode vocabulary
 *      → stays an enum prop + named note.
 *   6. A `variant=default|inverse` axis that changes anatomy stays a prop —
 *      the name table never fires (no mode note at all).
 *
 * Node shell over pure core functions. Reads the repo; writes nothing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { capturedTokensFromDump } from '../../core/captured-tokens.js';
import { emitters, type EmitterCtx } from '../../core/emitter.js';
import { generateCss, validateContract } from '../../core/emit-react.js';
import { flattenTokens, tokenInventoryFromJson, type TokenTreeInput } from '../../core/tokens.js';
import { proposeBatchFromDump, type FigmaProposalResult } from '../../core/propose-figma.js';
import type { DumpNode } from './types.js';
import { loadTokenCorpus } from './tokens.js';
import { loadContracts } from './propose.js';

const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

const corpus = loadTokenCorpus(ROOT);
const loaded = loadContracts(path.resolve(ROOT, 'contracts'));
const repoContracts = new Map<string, Contract>(
  readdirSync(path.join(ROOT, 'contracts'))
    .filter((f) => f.endsWith('.contract.json'))
    .map((f) => ContractSchema.parse(read(path.join('contracts', f))))
    .map((c) => [c.id, c]),
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
const repoTrees = {
  primitives: read('tokens/primitives.tokens.json'),
  semantic: read('tokens/semantic.tokens.json'),
  light: read('tokens/modes/semantic.light.tokens.json'),
  dark: read('tokens/modes/semantic.dark.tokens.json'),
};
const repoInventory = tokenInventoryFromJson([repoTrees.primitives, repoTrees.semantic, repoTrees.light, repoTrees.dark]);

function mergeTrees(docs: Record<string, unknown>[]): Record<string, unknown> {
  const merge = (a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = { ...a };
    for (const [k, v] of Object.entries(b)) {
      const prev = out[k];
      out[k] =
        prev && v && typeof prev === 'object' && typeof v === 'object' && !Array.isArray(prev) && !Array.isArray(v)
          ? merge(prev as Record<string, unknown>, v as Record<string, unknown>)
          : v;
    }
    return out;
  };
  return docs.reduce(merge, {});
}

// ---------------------------------------------------------------------------
// The synthetic CBDS-shaped themed set (dump v1.6): theme × variant, bound
// fills with CBDS-style slash names (SAME names on both themes), a raw-hex
// accent whose color differs per theme (color-kind literal — corroborated).
// ---------------------------------------------------------------------------

const themedVariant = (theme: string, variant: string, opts?: { accentHex?: string; extraChild?: boolean; textVar?: string }): DumpNode => ({
  name: `theme=${theme}, variant=${variant}`,
  type: 'COMPONENT',
  layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', spacing: 8, padding: [8, 16, 8, 16], primarySizing: 'AUTO', counterSizing: 'AUTO' },
  cornerRadius: 4,
  fill: { var: `bg/${variant}` },
  children: [
    {
      name: 'Accent',
      type: 'FRAME',
      fill: { hex: opts?.accentHex ?? (theme === 'light' ? '1e62d0' : '9ec2ff') },
      layout: { mode: 'HORIZONTAL', primary: 'CENTER', counter: 'CENTER', spacing: 0, padding: [0, 0, 0, 0], primarySizing: 'FIXED', counterSizing: 'FIXED' },
    },
    {
      name: 'Message',
      type: 'TEXT',
      text: { characters: 'Something happened', fontSize: 14, fontStyle: 'Regular', fillVar: opts?.textVar ?? 'text/primary' },
    },
    ...(opts?.extraChild
      ? [{ name: 'Divider', type: 'FRAME' as const, fill: { hex: '000000' } }]
      : []),
  ],
});

const themedDump = {
  _provenance: { fileKey: null, dumpVersion: '1.6' },
  _variables: {
    'bg/info': { type: 'COLOR', value: '#eef4ff', modes: { light: '#eef4ff', dark: '#0b1d3a' } },
    'bg/error': { type: 'COLOR', value: '#fdeeee', modes: { light: '#fdeeee', dark: '#3a0b0b' } },
    'text/primary': { type: 'COLOR', value: '#1b1f26', modes: { light: '#1b1f26', dark: '#fcfeff' } },
  },
  'Alert Banner': {
    setName: 'Alert Banner',
    type: 'COMPONENT_SET',
    variants: [
      themedVariant('light', 'info'),
      themedVariant('light', 'error'),
      themedVariant('dark', 'info'),
      themedVariant('dark', 'error'),
    ],
  },
};

interface Replay {
  contract: Contract;
  proposal: FigmaProposalResult & { setName: string };
  violations: string[];
  emitted: number;
  refusals: string[];
}

function replay(dump: Record<string, unknown>): Replay {
  const captured = capturedTokensFromDump(dump);
  const capturedRegistered = (captured?.entries ?? []).filter((e) => !repoInventory.has(e.path));
  const capturedTree: Record<string, unknown> = {};
  for (const e of capturedRegistered) {
    const segs = e.path.split('.');
    let node = capturedTree;
    for (const seg of segs.slice(0, -1)) node = (node[seg] ??= {}) as Record<string, unknown>;
    node[segs[segs.length - 1]] = { $value: e.value, $type: e.type };
  }
  const batch = proposeBatchFromDump(dump, {
    corpus,
    contractIdByName: loaded.byName,
    contractsById: loaded.byId,
    fileKey: null,
    mintUnbound: true,
  });
  if (batch.proposals.length !== 1) throw new Error(`expected 1 proposal, got ${batch.proposals.length}`);
  const proposal = batch.proposals[0];
  const contract = ContractSchema.parse(proposal.contract);
  const contracts = new Map(repoContracts);
  contracts.set(contract.id, contract);
  for (const raw of proposal.childStubs ?? []) {
    const stub = ContractSchema.safeParse(raw);
    if (stub.success && !contracts.has(stub.data.id)) contracts.set(stub.data.id, stub.data);
  }
  const mintedTree = (proposal.mintedTokens?.tree ?? {}) as Record<string, unknown>;
  const inventory = new Set<string>([
    ...repoInventory,
    ...capturedRegistered.map((e) => e.path),
    ...flattenTokens(mintedTree).keys(),
  ]);
  const violations: string[] = [];
  validateContract(contract, contracts, violations, icons);
  generateCss(contract, inventory, violations);
  const tokens: TokenTreeInput = {
    ...repoTrees,
    semantic: mergeTrees([mergeTrees([repoTrees.semantic as Record<string, unknown>, capturedTree]), mintedTree]),
    brands,
  };
  const ctx: EmitterCtx = { tokens, icons, contracts, mintedTokens: mintedTree };
  let emitted = 0;
  const refusals: string[] = [];
  for (const emitter of emitters) {
    try {
      emitter.emit(contract, ctx);
      emitted++;
    } catch (e) {
      refusals.push(`${emitter.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { contract, proposal, violations, emitted, refusals };
}

// ---------------------------------------------------------------------------
// 1 + 2. Corroborated theme axis promotes; mint isolation holds
// ---------------------------------------------------------------------------

console.log('1. corroborated Theme=light|dark axis (CBDS-shaped synthetic, dump v1.6)');
{
  const r = replay(themedDump as unknown as Record<string, unknown>);
  check('NO `theme` prop ships in the API', !r.contract.props.some((p) => p.name === 'theme'));
  check(`the API keeps the real axis (props: ${r.contract.props.map((p) => p.name).join(', ')})`,
    r.contract.props.length === 1 && r.contract.props[0].name === 'variant');
  check('contract `modes` metadata names the token modes (["light","dark"])',
    JSON.stringify(r.contract.modes) === '["light","dark"]');
  const note = r.proposal.notes.find((n) =>
    n.includes('variant axis "theme" (light|dark) IS a token-mode axis, not API (§3 — structurally corroborated') &&
    n.includes('anatomy and facts build from the 2 "light" (default-mode) variant(s) only') &&
    n.includes("other modes' resolved literals are NOT minted") &&
    n.includes('Rename story: regeneration draws the default mode only'),
  );
  check('the promotion is the NAMED §3 receipt (corroboration + mint isolation + rename story spelled out)', note !== undefined);
  const rootTokens = r.contract.anatomy.root.tokens ?? {};
  check(`base facts bind the REAL variable names from the light variants (background-color = {bg.{variant}}; got ${String(rootTokens['background-color'])})`,
    rootTokens['background-color'] === '{bg.{variant}}');
  const mintedJson = JSON.stringify(r.proposal.mintedTokens ?? {});
  check('the LIGHT accent literal mints (#1e62d0 — the default mode feeds the mint pass)', mintedJson.includes('#1e62d0'));
  check('the DARK accent literal mints NOWHERE (#9ec2ff — mode-excluded variants never fabricate a second palette)', !mintedJson.includes('#9ec2ff'));
  check(`referee CLEAN (got ${r.violations.length})`, r.violations.length === 0);
  check(`ALL FOUR surfaces emit (got ${r.emitted}/${emitters.length})`, r.emitted === emitters.length && r.refusals.length === 0);
}

// ---------------------------------------------------------------------------
// 3. MODES RESOLVE on the captured-token layer (dump v1.6)
// ---------------------------------------------------------------------------

console.log('\n2. per-mode captured-variable values (core/captured-tokens.ts modes channel)');
{
  const layer = capturedTokensFromDump(themedDump as unknown as Record<string, unknown>)!;
  check(`3 variables captured, 3 registrable (got ${layer.count})`, layer.count === 3);
  check('the layer carries per-mode trees (modes: light, dark)',
    layer.modes !== undefined && JSON.stringify(Object.keys(layer.modes).sort()) === '["dark","light"]');
  const darkFlat = layer.modes ? flattenTokens(layer.modes.dark.tree) : new Map();
  const lightFlat = layer.modes ? flattenTokens(layer.modes.light.tree) : new Map();
  check(`{bg.info} RESOLVES per mode — light #eef4ff, dark #0b1d3a (got ${String(lightFlat.get('bg.info')?.value)} / ${String(darkFlat.get('bg.info')?.value)})`,
    lightFlat.get('bg.info')?.value === '#eef4ff' && darkFlat.get('bg.info')?.value === '#0b1d3a');
  check(`{text.primary} RESOLVES per mode — dark #fcfeff (got ${String(darkFlat.get('text.primary')?.value)})`,
    darkFlat.get('text.primary')?.value === '#fcfeff');
  check('the per-mode trees mirror the repo token-vocabulary shape (tokens/modes/*.tokens.json: a tree per mode)',
    layer.modes?.dark.count === 3 && layer.modes?.light.count === 3);
}

// ---------------------------------------------------------------------------
// 4. Near-miss: theme-NAMED axis, structure differs → stays a prop + WARNING
// ---------------------------------------------------------------------------

console.log('\n3. near-miss: theme-named axis whose variants differ structurally');
{
  const dump = {
    _provenance: { fileKey: null, dumpVersion: '1.6' },
    _variables: (themedDump as { _variables: unknown })._variables,
    'Alert Banner Divergent': {
      setName: 'Alert Banner Divergent',
      type: 'COMPONENT_SET',
      variants: [
        { ...themedVariant('light', 'info'), name: 'theme=light, variant=info' },
        { ...themedVariant('dark', 'info', { extraChild: true }), name: 'theme=dark, variant=info' },
      ],
    },
  };
  const r = replay(dump as unknown as Record<string, unknown>);
  const warning = r.proposal.notes.find((n) =>
    n.includes('variant axis "theme" (light|dark): named like a token mode but the variants differ beyond color across its values') &&
    n.includes('2 vs 3 children') &&
    n.includes('NOT promoted; kept as an enum prop (if this is theming, unify the drawn structure), review'),
  );
  check('the near-miss is a WARNING note naming the first structural difference (2 vs 3 children)', warning !== undefined);
  const themeProp = r.contract.props.find((p) => p.name === 'theme');
  check('`theme` STAYS an enum prop (uncorroborated promotion never drops an axis silently)',
    themeProp !== undefined && typeof themeProp.type === 'object' && 'enum' in themeProp.type);
  check('no `modes` metadata ships', r.contract.modes === undefined);
}

// ---------------------------------------------------------------------------
// 5. Near-miss: theme-NAMED axis, value outside the mode vocabulary
// ---------------------------------------------------------------------------

console.log('\n4. near-miss: theme-named axis with a value outside the mode vocabulary');
{
  const dump = {
    _provenance: { fileKey: null, dumpVersion: '1.6' },
    _variables: (themedDump as { _variables: unknown })._variables,
    'Alert Banner Branded': {
      setName: 'Alert Banner Branded',
      type: 'COMPONENT_SET',
      variants: [
        { ...themedVariant('light', 'info'), name: 'theme=light, variant=info' },
        { ...themedVariant('dark', 'info'), name: 'theme=contrast-plus, variant=info' },
      ],
    },
  };
  const r = replay(dump as unknown as Record<string, unknown>);
  const note = r.proposal.notes.find((n) =>
    n.includes('variant axis "theme": named like a token-mode axis but value(s) contrast-plus are outside the mode vocabulary (light|dark|high-contrast|dim|black|white) — kept as an enum prop, review'),
  );
  check('the out-of-vocabulary value is a NAMED note; the axis stays a prop', note !== undefined);
  check('`theme` ships as an enum prop', r.contract.props.some((p) => p.name === 'theme'));
}

// ---------------------------------------------------------------------------
// 6. `variant=default|inverse` changing anatomy stays a prop (name table
//    never fires — a structural axis is API, whatever it restyles)
// ---------------------------------------------------------------------------

console.log('\n5. variant=default|inverse axis that changes anatomy stays a prop');
{
  const dump = {
    _provenance: { fileKey: null, dumpVersion: '1.6' },
    _variables: (themedDump as { _variables: unknown })._variables,
    'Inverse Banner': {
      setName: 'Inverse Banner',
      type: 'COMPONENT_SET',
      variants: [
        { ...themedVariant('light', 'info'), name: 'variant=default' },
        { ...themedVariant('dark', 'info', { extraChild: true }), name: 'variant=inverse' },
      ],
    },
  };
  const r = replay(dump as unknown as Record<string, unknown>);
  const variantProp = r.contract.props.find((p) => p.name === 'variant');
  check('`variant` ships as an enum prop (default|inverse)',
    variantProp !== undefined && typeof variantProp.type === 'object' && 'enum' in variantProp.type &&
    JSON.stringify((variantProp.type as { enum: string[] }).enum) === '["default","inverse"]');
  check('no mode-axis note fires at all (the name table never matches "variant")',
    !r.proposal.notes.some((n) => n.includes('token-mode axis') || n.includes('token mode')));
  check('no `modes` metadata ships', r.contract.modes === undefined);
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} theme-mode check(s) failed`);
  process.exit(1);
}
console.log('\n✔ §3 holds — a corroborated theme axis is a token mode (never a prop, modes resolve, dark literals never mint); near-misses stay props with named notes');
