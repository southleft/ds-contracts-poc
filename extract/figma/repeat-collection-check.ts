/**
 * Receipts for P9 — REPEATED-CHILDREN COLLECTIONS (schema v12 `repeat`).
 * `npm run extract:figma:repeat:check`.
 *
 * The defining composite pattern (extract/figma/gauntlet/PATTERN-TAXONOMY.md
 * P9): N adjacent sibling instances of the same child component. Before v12
 * they proposed as N hard-coded component-ref parts; now a run of ≥3 with a
 * homogeneous applied-prop shape and ≥1 carriable per-item field proposes as
 * ONE item-template part with `repeat` + a new arrayOf prop. Field rules are
 * deterministic and every carry/skip is a NAMED note; per-item ENUM/state
 * differences (the selected tab, P10) and pre-v1.5 TEXT/VARIANT-ambiguous
 * string keys stay receipts, never guesses.
 *
 * Pinned here:
 *   1. REAL owner's-kit fixture (Navigation-Header, the census composition):
 *      the 5 Link-Neutral menu items propose ONE repeat part with a varying
 *      boolean field, the ambiguous '✏️text' and the "Show item N" count
 *      controls are receipted, and all four surfaces render — React maps the
 *      live array; html/canvas render the observed sample.
 *   2. SYNTHETIC v1.5-shaped run (Badge Row): '#'-suffixed TEXT keys carry
 *      per-item text ('children' field); a varying enum applied prop is the
 *      P10 receipt.
 *   3. No carriable field → the pattern is receipted and the siblings stay
 *      fixed parts (Pagination-shaped run whose only variation is `state`).
 *   4. The census's arrayOf-candidate fixture (Text Area) proposes UNCHANGED
 *      — its Notches are one-per-variant, not a sibling run.
 *
 * Node shell over pure core functions. Reads the repo + committed fixtures;
 * writes nothing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, walkAnatomy, type Contract } from '../../scripts/contract-schema.js';
import { capturedTokensFromDump } from '../../core/captured-tokens.js';
import { emitters, type EmittedFile, type EmitterCtx } from '../../core/emitter.js';
import { generateCss, validateContract } from '../../core/emit-react.js';
import { flattenTokens, tokenInventoryFromJson, type TokenTreeInput } from '../../core/tokens.js';
import { proposeBatchFromDump, type FigmaProposalResult } from '../../core/propose-figma.js';
import { loadTokenCorpus } from './tokens.js';
import { loadContracts } from './propose.js';

const ROOT = process.cwd();
const FIXTURE_DIR = path.join('extract', 'figma', 'gauntlet', 'fixtures');
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

interface Replay {
  contract: Contract;
  proposal: FigmaProposalResult & { setName: string };
  violations: string[];
  refusals: Array<{ emitter: string; message: string }>;
  /** emitter name → emitted files. */
  files: Map<string, EmittedFile[]>;
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
  generateCss(contract, inventory, violations);
  const tokens: TokenTreeInput = {
    ...repoTrees,
    semantic: mergeTrees([mergeTrees([repoTrees.semantic as Record<string, unknown>, capturedTree]), mintedTree]),
    brands,
  };
  const ctx: EmitterCtx = { tokens, icons, contracts, fileKey: provenance?.fileKey ?? undefined, mintedTokens: mintedTree };
  const files = new Map<string, EmittedFile[]>();
  const refusals: Array<{ emitter: string; message: string }> = [];
  for (const emitter of emitters) {
    try {
      files.set(emitter.name, emitter.emit(contract, ctx));
    } catch (e) {
      refusals.push({ emitter: emitter.name, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return { contract, proposal, violations, refusals, files };
}

const surfaces = emitters.map((e) => e.name).join(', ');
const fileText = (r: Replay, emitter: string, suffix: string): string =>
  r.files.get(emitter)?.find((f) => f.path.endsWith(suffix))?.contents ?? '';

// ---------------------------------------------------------------------------
// 1. REAL fixture — Navigation-Header's 5 menu items
// ---------------------------------------------------------------------------

console.log('1. real owner\'s-kit run (pattern-repeat-collection-navigation-header.dump.json)');
{
  const r = replay(read(path.join(FIXTURE_DIR, 'pattern-repeat-collection-navigation-header.dump.json')));
  const repeatParts = walkAnatomy(r.contract).filter((w) => w.part.repeat);
  check(`exactly ONE repeat part proposes for the 5 drawn menu items (got ${repeatParts.length})`, repeatParts.length === 1);
  const rp = repeatParts[0]?.part.repeat;
  check(`the sample carries the 5 OBSERVED siblings (got ${rp?.sample.length})`, rp?.sample.length === 5);
  check('the sample carries the varying boolean per item (iconRight false/true/true/false/false)',
    JSON.stringify(rp?.sample.map((s) => s.iconRight)) === '[false,true,true,false,false]');
  const itemsProp = r.contract.props.find((p) => p.name === rp?.itemsProp);
  check('the arrayOf prop `items` ships code-only (bindings.figma.kind NONE)',
    itemsProp !== undefined && typeof itemsProp.type === 'object' && 'arrayOf' in itemsProp.type && itemsProp.bindings.figma.kind === 'NONE');
  check('its fields are exactly the carriable per-item facts ({ iconRight: boolean })',
    JSON.stringify((itemsProp?.type as { arrayOf?: unknown })?.arrayOf) === '{"iconRight":"boolean"}');

  const flagship = r.proposal.notes.find((n) =>
    n.includes('5 adjacent sibling instances of "Link-Neutral" with a homogeneous applied-prop shape — proposed as ONE item-template part with repeat over arrayOf prop `items` (P9; fields: iconRight:boolean)') &&
    n.includes('the meter discipline: canvas and static surfaces render the OBSERVED sample; code maps the live array'),
  );
  check('the collection carry is the NAMED flagship note (P9, meter discipline spelled out)', flagship !== undefined);
  const ambiguous = r.proposal.notes.find((n) =>
    n.includes('applied prop "✏️text" varies per sibling') &&
    n.includes('a bare string key is VARIANT/TEXT-ambiguous (pre-v1.5 dump, no "#id" suffix) — not carried as a field; recapture with the v1.5 plugin'),
  );
  check('the per-item TEXT stays a NAMED ambiguity receipt (pre-v1.5 dump — never guessed)', ambiguous !== undefined);
  const countControls = r.proposal.notes.find((n) =>
    n.includes('per-sibling visibility bindings') &&
    n.includes('the canvas\'s drawn COUNT controls ("Show item N", the P9 canvas count spelling) — not promoted to boolean props'),
  );
  check('the "Show item N" count booleans are receipted, never promoted (rename story named)', countControls !== undefined);
  check('no menuItem1…5 boolean props ship', !r.contract.props.some((p) => /^menuItem\d$/.test(p.name)));

  check(`referee CLEAN (got ${r.violations.length})`, r.violations.length === 0);
  check(`ALL FOUR surfaces emit (${surfaces})`, r.files.size === emitters.length && r.refusals.length === 0);
  const tsx = fileText(r, 'react', 'NavigationHeader.tsx');
  check('React maps the LIVE array ({items?.map((item, index) => …iconRight={item.iconRight}…)})',
    tsx.includes('{items?.map((item, index) => (<LinkNeutral key={index}') && tsx.includes('iconRight={item.iconRight}'));
  const script = fileText(r, 'figma-script', '.js') || fileText(r, 'figma-script', '.mjs') || [...(r.files.get('figma-script') ?? [])].map((f) => f.contents).join('');
  check('the canvas constructs the OBSERVED instances (5 LinkNeutral sample instances in the sync script)',
    (script.match(/"dep":\s*"LinkNeutral"/g) ?? script.match(/LinkNeutral/g) ?? []).length >= 5);
}

// ---------------------------------------------------------------------------
// 2. SYNTHETIC v1.5-shaped run — per-item TEXT carries ('#'-suffixed keys)
// ---------------------------------------------------------------------------

console.log('\n2. v1.5-shaped run (Badge Row: "#"-suffixed TEXT keys + a varying enum)');
{
  const badgeItem = (label: string, variant: string) => ({
    name: 'Badge',
    type: 'INSTANCE',
    instanceOf: 'Badge',
    componentProperties: { 'Label#1:0': label, Variant: variant },
  });
  const dump = {
    _provenance: { fileKey: null, dumpVersion: '1.5' },
    'Badge Row': {
      setName: 'Badge Row',
      type: 'COMPONENT_SET',
      variants: [
        {
          name: 'density=default',
          type: 'COMPONENT',
          layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', spacing: 8, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO' },
          children: [
            badgeItem('One', 'Info'),
            badgeItem('Two', 'Info'),
            badgeItem('Three', 'Success'),
            badgeItem('Four', 'Info'),
          ],
        },
      ],
    },
  };
  const r = replay(dump as Record<string, unknown>);
  const repeatParts = walkAnatomy(r.contract).filter((w) => w.part.repeat);
  check(`ONE repeat part proposes (got ${repeatParts.length})`, repeatParts.length === 1);
  const rp = repeatParts[0]?.part.repeat;
  const itemsProp = r.contract.props.find((p) => p.name === rp?.itemsProp);
  check('per-item TEXT carries as a field — the "#id" suffix is TEXT certainty (fields: { children: text })',
    JSON.stringify((itemsProp?.type as { arrayOf?: unknown })?.arrayOf) === '{"children":"text"}');
  check('the sample carries the drawn labels VERBATIM (One/Two/Three/Four)',
    JSON.stringify(rp?.sample.map((s) => s.children)) === '["One","Two","Three","Four"]');
  const p10 = r.proposal.notes.find((n) =>
    n.includes('applied prop "Variant" varies per sibling (Info, Success)') &&
    n.includes('per-item enum/state differences are P10 (selected-item) with no repeat vocabulary; receipted, the sample renders ds.badge\'s default'),
  );
  check('the varying enum is the P10 receipt (selected-item stays note-gated, never carried)', p10 !== undefined);
  check(`referee CLEAN (got ${r.violations.length})`, r.violations.length === 0);
  check(`ALL FOUR surfaces emit (${surfaces})`, r.files.size === emitters.length && r.refusals.length === 0);
  const tsx = fileText(r, 'react', 'BadgeRow.tsx');
  check('React renders the text field as JSX children ({items?.map((item, index) => (<Badge key={index}>{item.children}</Badge>))})',
    tsx.includes('{items?.map((item, index) => (<Badge key={index}>{item.children}</Badge>))}'));
  const html = fileText(r, 'html', '.html');
  check('the static surface renders the OBSERVED sample per item (One…Four appear in the html)',
    ['One', 'Two', 'Three', 'Four'].every((t) => new RegExp(`(>|\\n\\s*)${t}(<|\\n)`).test(html)));
}

// ---------------------------------------------------------------------------
// 3. No carriable field → NAMED fallback, fixed parts as before
// ---------------------------------------------------------------------------

console.log('\n3. no carriable field (pagination-shaped run: only `state` varies)');
{
  const num = (state: string) => ({
    name: '_pagination-number',
    type: 'INSTANCE',
    instanceOf: '_pagination-number',
    componentProperties: { state, size: 'small' },
  });
  const dump = {
    _provenance: { fileKey: null },
    Pager: {
      setName: 'Pager',
      type: 'COMPONENT_SET',
      variants: [
        {
          name: 'size=small',
          type: 'COMPONENT',
          layout: { mode: 'HORIZONTAL', primary: 'MIN', counter: 'CENTER', spacing: 4, padding: [0, 0, 0, 0], primarySizing: 'AUTO', counterSizing: 'AUTO' },
          children: [num('default'), num('default'), num('selected'), num('default'), num('default')],
        },
      ],
    },
  };
  const r = replay(dump as Record<string, unknown>);
  const fallback = r.proposal.notes.find((n) =>
    n.includes('5 adjacent sibling instances of "_pagination-number" (repeated-children collection, P9) but no per-item field is carriable — kept as 5 fixed parts'),
  );
  check('the pattern is DETECTED and the fallback is a NAMED note (no field invented)', fallback !== undefined);
  check('no repeat part ships', !walkAnatomy(r.contract).some((w) => w.part.repeat));
  check('no arrayOf prop ships', !r.contract.props.some((p) => typeof p.type === 'object' && 'arrayOf' in p.type));
  check('the 5 siblings stay fixed component-ref parts',
    walkAnatomy(r.contract).filter((w) => w.part.component).length === 5);
  check(`referee CLEAN (got ${r.violations.length})`, r.violations.length === 0);
}

// ---------------------------------------------------------------------------
// 4. The census arrayOf-candidate fixture proposes UNCHANGED
// ---------------------------------------------------------------------------

console.log('\n4. census arrayOf-candidate fixture (Text Area — one Notches per variant, not a run)');
{
  const r = replay(read(path.join(FIXTURE_DIR, 'pattern-arrayof-candidate-text-area.dump.json')));
  check('no repeat part proposes (the candidate is one-per-variant, not a sibling run)',
    !walkAnatomy(r.contract).some((w) => w.part.repeat));
  check('no arrayOf prop ships', !r.contract.props.some((p) => typeof p.type === 'object' && 'arrayOf' in p.type));
  check(`referee CLEAN (got ${r.violations.length})`, r.violations.length === 0);
  check(`ALL FOUR surfaces emit (${surfaces})`, r.files.size === emitters.length && r.refusals.length === 0);
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} repeat-collection check(s) failed`);
  process.exit(1);
}
console.log('\n✔ P9 holds — repeated children propose as ONE repeat part + arrayOf prop; the observed sample renders; enums/ambiguity stay receipts');
