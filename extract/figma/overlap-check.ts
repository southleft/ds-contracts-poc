/**
 * Receipts for P21 — OVERLAP COLLECTIONS (negative auto-layout spacing).
 * `npm run extract:figma:overlap:check`.
 *
 * The pattern (extract/figma/gauntlet/PATTERN-TAXONOMY.md P21): an
 * AvatarGroup-shaped set draws its children with NEGATIVE itemSpacing. The
 * pre-P21 proposer minted that observation as a plain negative-px gap token —
 * actively wrong twice over: `gap: -8px` is invalid CSS (parses to nothing,
 * so the overlap silently vanished), and nothing carried the fact that the
 * children OVERLAP. The vocabulary already exists — `layout.overlap: true`
 * with the gap token carrying the drawn (negative) magnitude, whose shipped
 * projection is the ds.avatar-group owner-precedent ({space.avatarGroup.
 * overlap} → {space.overlap} = -8px): a negative CHILD MARGIN in CSS,
 * negative itemSpacing on the canvas.
 *
 * Pinned here, on the REAL owner's-kit fixture plus a uniform-negative
 * replay of the same set:
 *
 *   1. UNIFORM negative spacing (every variant) → layout.overlap: true, the
 *      gap token mints with the DRAWN value, and the CSS surfaces project it
 *      as a negative child margin — never as an invalid CSS `gap`.
 *   2. MIXED-sign spacing (the live Avatar group: type=space 4px vs
 *      type=overlap -8px) → overlap is a per-part invariant with no
 *      per-variant form, so nothing is guessed: gap is NOT minted, the limit
 *      is a NAMED note, and the unbound report survives for review. No
 *      plain negative-px gap token exists anywhere in the output.
 *
 * Node shell over pure core functions — the same split as every receipt in
 * extract/figma/. Reads the repo and the committed fixture; writes nothing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../scripts/contract-schema.js';
import { capturedTokensFromDump } from '../../core/captured-tokens.js';
import { emitters, type EmitterCtx } from '../../core/emitter.js';
import { generateCss, validateContract } from '../../core/emit-react.js';
import { emitHtml } from '../../core/emit-html.js';
import { flattenTokens, tokenInventoryFromJson, type TokenTreeInput } from '../../core/tokens.js';
import { proposeBatchFromDump, type FigmaProposalResult } from '../../core/propose-figma.js';
import { loadTokenCorpus } from './tokens.js';
import { loadContracts } from './propose.js';

const ROOT = process.cwd();
const FIXTURE = path.join('extract', 'figma', 'gauntlet', 'fixtures', 'component-ref-unknown-child-prop-avatar-group.dump.json');
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

// Census/playground receive composition (class-fix-check.ts shape).
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

interface Replay {
  contract: Contract;
  proposal: FigmaProposalResult & { setName: string };
  violations: string[];
  emitted: string[];
  refusals: Array<{ emitter: string; message: string }>;
  css: string;
  html: string;
  ctx: EmitterCtx;
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
  const provenance = dump._provenance as { fileKey?: string } | undefined;
  const batch = proposeBatchFromDump(dump, {
    corpus,
    contractIdByName: loaded.byName,
    contractsById: loaded.byId,
    fileKey: provenance?.fileKey ?? null,
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
  const css = generateCss(contract, inventory, violations);
  const tokens: TokenTreeInput = {
    ...repoTrees,
    semantic: mergeTrees([mergeTrees([repoTrees.semantic as Record<string, unknown>, capturedTree]), mintedTree]),
    brands,
  };
  const ctx: EmitterCtx = {
    tokens,
    icons,
    contracts,
    fileKey: provenance?.fileKey ?? undefined,
    mintedTokens: mintedTree,
  };
  const emitted: string[] = [];
  const refusals: Array<{ emitter: string; message: string }> = [];
  for (const emitter of emitters) {
    try {
      emitter.emit(contract, ctx);
      emitted.push(emitter.name);
    } catch (e) {
      refusals.push({ emitter: emitter.name, message: e instanceof Error ? e.message : String(e) });
    }
  }
  const html =
    refusals.length === 0 ? emitHtml(contract, { tokens: inventory, icons, contracts }).css : '';
  return { contract, proposal, violations, emitted, refusals, css, html, ctx };
}

const surfaces = emitters.map((e) => e.name).join(', ');
const fixtureDump = read(FIXTURE);

// ---------------------------------------------------------------------------
// 1. UNIFORM negative spacing → layout.overlap + the drawn magnitude
// ---------------------------------------------------------------------------

console.log('1. uniform negative itemSpacing (avatar-group-shaped set — the owner\'s overlap variants, literal spacing)');
{
  // The live set, restricted to its type=overlap variants (the axis pair
  // stripped) — a pure overlap collection, every variant negative. The live
  // kit binds itemSpacing to a variable whose NAME is outside the token-ref
  // grammar ("spacing/100 negative" — the existing named refusal, pinned in
  // section 3); the LITERAL spelling below is the avatar-group shape most
  // kits draw, and the path P21 fixes.
  const set = JSON.parse(JSON.stringify(fixtureDump['Avatar group'])) as {
    setName: string;
    variants: Array<{ name: string; bound?: Record<string, string> }>;
  };
  set.setName = 'Avatar group overlap';
  set.variants = set.variants
    .filter((v) => v.name.includes('type=overlap'))
    .map((v) => ({ ...v, name: v.name.replace(/,\s*type=overlap/, '') }));
  for (const v of set.variants) delete v.bound?.itemSpacing;
  const dump = {
    _provenance: fixtureDump._provenance,
    _variables: fixtureDump._variables,
    'Avatar group overlap': set,
  };
  const r = replay(dump as Record<string, unknown>);
  check(`3 size variants replay (got ${set.variants.length})`, set.variants.length === 3);

  const rootLayout = (r.contract.anatomy.root.layout ?? {}) as { overlap?: boolean };
  check('root proposes layout.overlap: true (children OVERLAP — P21)', rootLayout.overlap === true);
  const note = r.proposal.notes.find((n) =>
    n.includes('negative itemSpacing in every variant — children OVERLAP (P21); proposed as layout.overlap: true') &&
    n.includes('the ds.avatar-group owner-precedent where {space.overlap} = -8px') &&
    n.includes('never an invalid CSS `gap`'),
  );
  check('the overlap carry is a NAMED note (owner-precedent projection spelled out)', note !== undefined);

  const gapRef = (r.contract.anatomy.root.tokens ?? {})['gap'];
  check(`root gap binds a minted token (got ${String(gapRef)})`, typeof gapRef === 'string' && gapRef.startsWith('{imported.'));
  const gapEntry = r.proposal.mintedTokens?.entries.find((e) => e.ref === gapRef);
  check(`the minted gap token carries the DRAWN magnitude -8px (got ${String(gapEntry?.value)})`, gapEntry?.value === '-8px');

  check('CSS projects the overlap as a negative CHILD MARGIN (.root > * + * { margin-left: … })',
    /\.root > \* \+ \* \{\n  margin-left: var\(--imported-[a-z0-9-]+-gap\);\n\}/.test(r.css));
  check('CSS never emits the invalid `gap:` declaration for the overlap token', !/  gap: var\(--imported-/.test(r.css));
  check(`referee CLEAN (got ${r.violations.length})`, r.violations.length === 0);
  check(`ALL FOUR surfaces emit (${surfaces})`, r.emitted.length === emitters.length && r.refusals.length === 0);
  check('emit-html mirrors the projection (child-margin rule, no invalid gap)',
    r.html.includes('> * + *') && r.html.includes('margin-left: var(--imported-') && !/  gap: var\(--imported-/.test(r.html));
}

// ---------------------------------------------------------------------------
// 2. MIXED-sign spacing (the live set verbatim) → NAMED, never minted
// ---------------------------------------------------------------------------

console.log('\n2. mixed-sign itemSpacing (the live set\'s type=space 4 / type=overlap -8, literal spelling)');
{
  const set = JSON.parse(JSON.stringify(fixtureDump['Avatar group'])) as {
    setName: string;
    variants: Array<{ bound?: Record<string, string> }>;
  };
  set.setName = 'Avatar group mixed';
  for (const v of set.variants) delete v.bound?.itemSpacing;
  const dump = {
    _provenance: fixtureDump._provenance,
    _variables: fixtureDump._variables,
    'Avatar group mixed': set,
  };
  const r = replay(dump as Record<string, unknown>);
  const note = r.proposal.notes.find((n) =>
    n.includes('itemSpacing is NEGATIVE in 3/6 variant(s) (4/-8)') &&
    n.includes('layout.overlap is a per-part invariant with no per-variant form (P21)') &&
    n.includes('gap NOT minted'),
  );
  check('the mixed-sign limit is a NAMED note (per-part invariant, gap NOT minted)', note !== undefined);
  const rootLayout = (r.contract.anatomy.root.layout ?? {}) as { overlap?: boolean };
  check('layout.overlap is NOT set (overlap holds in only half the variants — never guessed)', rootLayout.overlap !== true);
  check('no gap binding ships on the root', (r.contract.anatomy.root.tokens ?? {})['gap'] === undefined);
  const negativeMint = (r.proposal.mintedTokens?.entries ?? []).filter((e) => String(e.value).startsWith('-'));
  check(`NO negative px token mints anywhere (got ${negativeMint.length}; the pre-P21 bug class is gone)`, negativeMint.length === 0);
  const unbound = r.proposal.unbound.find((u) => u.property === 'itemSpacing');
  check('the unbound itemSpacing report SURVIVES for review', unbound !== undefined);
  check(`referee CLEAN (got ${r.violations.length})`, r.violations.length === 0);
  check(`ALL FOUR surfaces emit (${surfaces})`, r.emitted.length === emitters.length && r.refusals.length === 0);
}

// ---------------------------------------------------------------------------
// 3. The live fixture VERBATIM (bound itemSpacing, illegal variable name)
// ---------------------------------------------------------------------------

console.log('\n3. the live Avatar group fixture verbatim (itemSpacing BOUND to "spacing/100 negative")');
{
  const r = replay(fixtureDump);
  const note = r.proposal.notes.find((n) =>
    n.includes('variable name "spacing/100 negative" contains characters outside the token-ref grammar'),
  );
  check('the bound-negative channel keeps its existing NAMED refusal (illegal variable name — rename or map manually)', note !== undefined);
  const negativeMint = (r.proposal.mintedTokens?.entries ?? []).filter((e) => String(e.value).startsWith('-'));
  check(`NO negative px token mints anywhere (got ${negativeMint.length})`, negativeMint.length === 0);
  check(`referee CLEAN (got ${r.violations.length})`, r.violations.length === 0);
  check(`ALL FOUR surfaces emit (${surfaces})`, r.emitted.length === emitters.length && r.refusals.length === 0);
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} overlap check(s) failed`);
  process.exit(1);
}
console.log('\n✔ P21 holds — negative spacing carries as layout.overlap (uniform) or a named limit (mixed); a plain negative-px gap token never mints');
