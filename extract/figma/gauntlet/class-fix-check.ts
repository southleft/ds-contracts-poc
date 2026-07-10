/**
 * Receipts for the CENSUS CLASS-FIX BATCH — replay of the three committed
 * class fixtures through the EXACT census/playground receive composition
 * (proposeBatchFromDump + captured-token layer + child stubs →
 * validateContract + generateCss referee → all four emitters), pinning:
 *
 *   1. component-ref-unknown-child-prop (Avatar group fixture) — applied
 *      props that do not map through an in-scope child contract's
 *      bindings.figma are DROPPED with the named note, never guessed; the
 *      referee is clean and all four surfaces emit.
 *   2. visiblewhen-value-outside-prop-enum (Alert fixture) — presence on a
 *      true/false axis spells the truthy form visibleWhen { prop } (the axis
 *      promotes to a BOOLEAN prop; equals: "true" is enum vocabulary); the
 *      referee is clean and all four surfaces emit. The inexpressible false
 *      side is pinned on a synthesized two-variant set (visibleWhen has no
 *      negated form — NAMED note, kept unconditional, never wrong).
 *   3. prop-binding-not-camelcase (Note fixture) — digit-led property
 *      spellings get the componentIdSlug digit-led discipline on prop code
 *      bindings ("2nd paragraph" → `p2ndParagraph`, deterministic "p"
 *      prefix) with the named note; the figma binding keeps the original
 *      spelling; the referee is clean and all four surfaces emit.
 *   4. figma-script referee — emit-figma-script calls validateContract: an
 *      invalid contract refuses BY NAME on the canvas surface exactly like
 *      react/html/react-inline (before the batch it was the one emitter that
 *      still emitted sync scripts for referee-violating sets).
 *
 * Node shell over pure core functions — the same split as every receipt in
 * extract/figma/. Reads the repo and the committed fixtures; writes nothing.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../../scripts/contract-schema.js';
import { capturedTokensFromDump } from '../../../core/captured-tokens.js';
import { emitters, type EmitterCtx } from '../../../core/emitter.js';
import { generateCss, validateContract } from '../../../core/emit-react.js';
import { emitFigmaScript } from '../../../core/emit-figma-script.js';
import { flattenTokens, tokenInventoryFromJson, type TokenTreeInput } from '../../../core/tokens.js';
import { proposeBatchFromDump } from '../../../core/propose-figma.js';
import { loadTokenCorpus } from '../tokens.js';
import { loadContracts } from '../propose.js';

const ROOT = process.cwd();
const FIXTURE_DIR = path.join('extract', 'figma', 'gauntlet', 'fixtures');
const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

const failures: string[] = [];
const check = (label: string, cond: boolean) => {
  if (!cond) failures.push(label);
  console.log(`  ${cond ? '✔' : '✖'} ${label}`);
};

// ---------------------------------------------------------------------------
// Shared inputs — the census composition (repo corpus/contracts/icons/tokens)
// ---------------------------------------------------------------------------

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

/** Deep-merge (later wins) — mirrors playground token-source mergeTrees. */
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
  notes: string[];
  violations: string[];
  emitted: string[];
  refusals: Array<{ emitter: string; message: string }>;
}

/** One fixture through the census/playground receive pipeline. */
function replay(fixtureFile: string): Replay {
  const dump = read(path.join(FIXTURE_DIR, fixtureFile));
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
  if (batch.proposals.length !== 1) throw new Error(`${fixtureFile}: expected 1 proposal, got ${batch.proposals.length} (${batch.skipped.length} skipped)`);
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
  return { contract, notes: proposal.notes, violations, emitted, refusals };
}

const surfaces = emitters.map((e) => e.name).join(', ');

// ---------------------------------------------------------------------------
// 1. component-ref-unknown-child-prop — Avatar group fixture
// ---------------------------------------------------------------------------

console.log('1. component-ref-unknown-child-prop (component-ref-unknown-child-prop-avatar-group.dump.json)');
{
  const r = replay('component-ref-unknown-child-prop-avatar-group.dump.json');
  const dropNote = r.notes.find((n) =>
    n.includes('applied prop "isVisible" on nested "Avatar" does not map through ds.avatar\'s bindings — not carried; verify the child contract is current'),
  );
  check('the unmappable applied prop is DROPPED with the named note (isVisible on nested Avatar → ds.avatar)', dropNote !== undefined);
  const anatomy = JSON.stringify(r.contract.anatomy);
  check('"isVisible" appears NOWHERE in the emitted anatomy (dropped, not guessed)', !anatomy.includes('isVisible'));
  check(`referee CLEAN (validateContract + generateCss report zero violations; got ${r.violations.length})`, r.violations.length === 0);
  check('no "sets unknown … prop" violation anywhere', !r.violations.some((v) => /sets unknown [a-z0-9.-]+ prop/.test(v)));
  check(`ALL FOUR surfaces emit (${surfaces})`, r.emitted.length === emitters.length && r.refusals.length === 0);
}

// ---------------------------------------------------------------------------
// 2. visiblewhen-value-outside-prop-enum — Alert fixture
// ---------------------------------------------------------------------------

console.log('\n2. visiblewhen-value-outside-prop-enum (visiblewhen-value-outside-prop-enum-alert.dump.json)');
{
  const r = replay('visiblewhen-value-outside-prop-enum-alert.dump.json');
  const truthyNote = r.notes.find((n) => n.includes('proposed as visibleWhen { prop: inlineAction } (boolean axis, truthy form)'));
  check('presence on the true/false axis is spelled as the TRUTHY form with the named note (visibleWhen { prop: inlineAction })', truthyNote !== undefined);
  const anatomy = JSON.stringify(r.contract.anatomy);
  check('no visibleWhen carries equals:"true"/"false" (boolean spelling, not enum vocabulary)', !anatomy.includes('"equals":"true"') && !anatomy.includes('"equals":"false"'));
  const inlineAction = r.contract.props.find((p) => p.name === 'inlineAction');
  check('the axis promoted to a BOOLEAN prop `inlineAction`', inlineAction?.type === 'boolean');
  check(`referee CLEAN (zero violations; got ${r.violations.length})`, r.violations.length === 0);
  check('no "visibleWhen.equals … is not a value of prop" violation anywhere', !r.violations.some((v) => v.includes('visibleWhen.equals')));
  check(`ALL FOUR surfaces emit (${surfaces})`, r.emitted.length === emitters.length && r.refusals.length === 0);

  // The FALSE side (present exactly where the boolean is false) is
  // inexpressible — visibleWhen has no negated form — and must be a NAMED
  // note with the part kept unconditional, never a wrong condition or a
  // refusal. Pinned on a synthesized two-variant set.
  const falseSide = proposeBatchFromDump(
    {
      _provenance: { fileKey: null },
      'False Side': {
        setName: 'False Side',
        type: 'COMPONENT_SET',
        variants: [
          {
            name: 'compact=true',
            type: 'COMPONENT',
            children: [{ name: 'Label', type: 'TEXT', text: { characters: 'Hi', fontSize: 14, fontStyle: 'Regular' } }],
          },
          {
            name: 'compact=false',
            type: 'COMPONENT',
            children: [
              { name: 'Label', type: 'TEXT', text: { characters: 'Hi', fontSize: 14, fontStyle: 'Regular' } },
              { name: 'Extra', type: 'TEXT', text: { characters: 'More', fontSize: 12, fontStyle: 'Regular' } },
            ],
          },
        ],
      },
    },
    { corpus, contractIdByName: loaded.byName, contractsById: loaded.byId, fileKey: null, mintUnbound: true },
  );
  const fsProposal = falseSide.proposals[0];
  const fsNote = fsProposal?.notes.find((n) =>
    n.includes('present exactly where "compact" is false — the visibleWhen vocabulary has no negated form, so the condition is inexpressible; kept unconditional (declared fidelity limit), review'),
  );
  check('false side: the inexpressible condition is a NAMED note (visibleWhen has no negated form; kept unconditional)', fsNote !== undefined);
  const fsAnatomy = JSON.stringify(fsProposal?.contract ?? {});
  check('false side: NO visibleWhen is invented on the part (never wrong)', !fsAnatomy.includes('visibleWhen'));
  const fsContract = ContractSchema.parse(fsProposal!.contract);
  const fsErrors: string[] = [];
  validateContract(fsContract, new Map([...repoContracts, [fsContract.id, fsContract]]), fsErrors, icons);
  check(`false side: referee CLEAN (got ${fsErrors.length})`, fsErrors.length === 0);
}

// ---------------------------------------------------------------------------
// 3. prop-binding-not-camelcase — Note fixture
// ---------------------------------------------------------------------------

console.log('\n3. prop-binding-not-camelcase (prop-binding-not-camelcase-note.dump.json)');
{
  const r = replay('prop-binding-not-camelcase-note.dump.json');
  const digitNote = r.notes.find((n) =>
    n.includes('prop `p2ndParagraph`: Figma property "2nd paragraph" is digit-led') &&
    n.includes('deterministic "p" prefix') &&
    n.includes('the original spelling stays the design binding (bindings.figma.property)'),
  );
  check('the digit-led rename is a NAMED note (`p2ndParagraph` ← "2nd paragraph", componentIdSlug discipline)', digitNote !== undefined);
  const prop = r.contract.props.find((p) => p.name === 'p2ndParagraph');
  check('prop name and code binding are `p2ndParagraph` (legal camelCase)', prop !== undefined && prop.bindings.code.prop === 'p2ndParagraph');
  check('the figma binding keeps the ORIGINAL spelling "2nd paragraph"', prop?.bindings.figma.property === '2nd paragraph');
  check(`referee CLEAN (zero violations; got ${r.violations.length})`, r.violations.length === 0);
  check('no "is not a legal camelCase identifier" violation anywhere', !r.violations.some((v) => v.includes('is not a legal camelCase identifier')));
  check(`ALL FOUR surfaces emit (${surfaces})`, r.emitted.length === emitters.length && r.refusals.length === 0);
}

// ---------------------------------------------------------------------------
// 4. figma-script referee — invalid contracts refuse BY NAME on the canvas
// ---------------------------------------------------------------------------

console.log('\n4. figma-script referee (emit-figma-script calls validateContract)');
{
  // A contract that is schema-valid but referee-invalid: visibleWhen points
  // at a prop that does not exist — exactly the shape the census found the
  // canvas surface silently emitting.
  const badge = repoContracts.get('ds.badge')!;
  const invalid = ContractSchema.parse(JSON.parse(JSON.stringify(badge))) as Contract;
  (invalid.anatomy.root as { visibleWhen?: { prop: string } }).visibleWhen = { prop: 'nonexistent' };
  let refusal: string | null = null;
  try {
    emitFigmaScript(invalid, { tokens: { ...repoTrees, brands }, icons, contracts: repoContracts });
  } catch (e) {
    refusal = e instanceof Error ? e.message : String(e);
  }
  check('emitFigmaScript REFUSES the invalid contract (no sync script emitted)', refusal !== null);
  check('the refusal is NAMED with the emitReact wording ("Refused — 1 contract violation(s)")', refusal?.startsWith('Refused — 1 contract violation(s)') === true);
  check('the violation names the part and prop (visibleWhen references unknown prop "nonexistent")', refusal?.includes('visibleWhen references unknown prop "nonexistent"') === true);
  // And the valid original still emits byte-for-byte the same script.
  const script = emitFigmaScript(badge, { tokens: { ...repoTrees, brands }, icons, contracts: repoContracts });
  check('the VALID repo contract still emits its sync script (golden untouched)', script.length > 0 && script.includes('ds.badge'));
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error(`\n✖ ${failures.length} class-fix check(s) failed`);
  process.exit(1);
}
console.log('\n✔ all class-fix invariants hold — the three census classes replay clean and the canvas surface referees');
