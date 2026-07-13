/**
 * THE LIVE GAUNTLET — tiered exercises over the owner's CBDS kit, offline
 * from the banked v1.6 capture. `npm run extract:figma:gauntlet:live`.
 *
 * Reads extract/figma/fixtures/cbds-plugin-all-sets.v16.dump.json and replays
 * every COMPONENT_SET (+ a seeded 50-set sample of the single-variant
 * COMPONENTs) through the EXACT playground receive semantics (the census
 * composition: proposeBatchFromDump + captured-token layer + child stubs →
 * validateContract + generateCss referee → all four emitters), then adds the
 * tiered exercises the census does not run:
 *
 *   T1  primitives — propose → referee → 4 emitters (base pass).
 *   T2  controls — every enum-value × boolean combo of the PROPOSED contract
 *       compiles (emit-html markup+CSS per combo; the canvas engine's
 *       compileComponentData once per set — its spec grid IS the combo space).
 *   T3  state promotion correctness, asserted mechanically: no state-like
 *       prop in the API, states carried, a drawn `disabled` axis value lands
 *       as a boolean prop.
 *   T4  composites WITH dependencies — SIMULATED SESSIONS (the playground
 *       receive semantics incl. session registry): children-first import
 *       must LINK (not stub) every child whose set was imported earlier;
 *       ADVERSARIAL order: parent-first stubs (observed-geometry mints
 *       checked), then the child, then the parent again — the self-heal
 *       upgrade path must link.
 *   T5  maximum — Dialog-class multi-level sessions, the Navigation-Header
 *       repeat collection (schema v12 repeat + arrayOf), the slot sets
 *       (_Slot-* placeholders / INSTANCE_SWAP; the kit draws ZERO native
 *       SLOT nodes — named), the id-collision pair (RadioButton the plain
 *       COMPONENT vs "Radio button" the set), and a 10-set MEGA-SESSION in
 *       mixed order with a final relink pass.
 *
 * Per-set scores: proposed / referee-clean / all-surfaces-emit / linked-vs-
 * stubbed correctness / facts-carried % / named notes + degradations. The
 * visual stage (pixelmatch vs the banked Figma PNGs) is visual-live.ts —
 * separate script, same tier table, cache-driven so it replays offline.
 *
 * ISOLATION: one set's failure never kills the run. Writes ONLY under
 * extract/figma/gauntlet/live/ (gauntlet.json + GAUNTLET.md + fixtures/).
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, componentRefsOf, slotsOf, type Contract } from '../../../../scripts/contract-schema.js';
import { capturedTokensFromDump } from '../../../../core/captured-tokens.js';
import { emitters, type EmitterCtx } from '../../../../core/emitter.js';
import { emitHtml } from '../../../../core/emit-html.js';
import { mintedTokenCss } from '../../../../core/mint-tokens.js';
import { createFigmaEngine } from '../../../../core/emit-figma-script.js';
import { generateCss, validateContract } from '../../../../core/emit-react.js';
import { flattenTokens, tokenInventoryFromJson, type TokenTreeInput } from '../../../../core/tokens.js';
import {
  componentIdSlug,
  dumpCapturesHidden,
  proposeBatchFromDump,
  proposeFromDump,
  type MinimalChildContract,
} from '../../../../core/propose-figma.js';
import { loadTokenCorpus } from '../../tokens.js';
import { loadContracts } from '../../propose.js';
import { dumpSets, sampleSingles, tierSets, type Tier } from './tiers.js';

const ROOT = process.cwd();
const HERE = path.join(ROOT, 'extract', 'figma', 'gauntlet', 'live');
const FIXTURE_DIR = path.join(HERE, 'fixtures');
const DUMP_PATH = path.join('extract', 'figma', 'fixtures', 'cbds-plugin-all-sets.v16.dump.json');
const COMBO_CAP = 256;

const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Repo composition (census conventions, verbatim semantics)
// ---------------------------------------------------------------------------

const dump = read(DUMP_PATH);
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

const captured = capturedTokensFromDump(dump);
const capturedRegistered = (captured?.entries ?? []).filter((e) => !repoInventory.has(e.path));
const capturedTree: Record<string, unknown> = {};
for (const e of capturedRegistered) {
  const segs = e.path.split('.');
  let node = capturedTree;
  for (const seg of segs.slice(0, -1)) node = (node[seg] ??= {}) as Record<string, unknown>;
  node[segs[segs.length - 1]] = { $value: e.value, $type: e.type };
}
const baseInventory = new Set<string>([...repoInventory, ...capturedRegistered.map((e) => e.path)]);
const baseSemantic = mergeTrees([repoTrees.semantic as Record<string, unknown>, capturedTree]);

const provenance = dump._provenance as { fileKey?: string } | undefined;
const hiddenCaptured = dumpCapturesHidden(dump._provenance as { note?: string; dumpVersion?: string } | undefined);
const sets = dumpSets(dump);
const tiers = tierSets(dump);
const tierByName = new Map(tiers.map((t) => [t.setName, t]));
const singles = sampleSingles(dump);

// ---------------------------------------------------------------------------
// Findings — every mechanical assertion failure lands here by CLASS, with
// named evidence. Known named limits are tagged, never re-reported as new.
// ---------------------------------------------------------------------------

interface Finding {
  cls: string;
  set: string;
  evidence: string;
  where: string;
  known?: 'named-limit' | 'fix-in-flight';
}
const findings: Finding[] = [];
const KNOWN_LIMIT = [
  { test: /glyph ink|instance-internal glyph/i, tag: 'named-limit' as const, name: 'instance-internal glyph ink' },
  { test: /ALPHA_TRIM|bare-alpha/i, tag: 'named-limit' as const, name: 'bare-alpha ALPHA_TRIM' },
  { test: /small-vertical FILL/i, tag: 'named-limit' as const, name: 'small-vertical FILL' },
  { test: /min-height-on-canvas/i, tag: 'named-limit' as const, name: 'min-height-on-canvas' },
  { test: /spacing\/100-negative/i, tag: 'named-limit' as const, name: 'spacing/100-negative name' },
  { test: /indeterminate/i, tag: 'named-limit' as const, name: 'indeterminate-AT' },
  { test: /imported\..*does not exist in tokens\//i, tag: 'fix-in-flight' as const, name: 'cross-import minted-token scope' },
  { test: /without correlating to any variant axis/i, tag: 'named-limit' as const, name: 'parent-axis-correlated stub geometry (197dd02)' },
  { test: /part-level state overrides are outside the contract vocabulary/i, tag: 'fix-in-flight' as const, name: 'disabled part-label (Part.states P18 — parallel worktree)' },
  { test: /cross-import-minted-token-scope/, tag: 'fix-in-flight' as const, name: 'cross-import minted-token scope (parallel worktree)' },
  { test: /duplicate anatomy part name/i, tag: 'fix-in-flight' as const, name: 'duplicate-part-name (dedup branch)' },
];
function addFinding(cls: string, set: string, evidence: string, where: string): void {
  const known = KNOWN_LIMIT.find((k) => k.test.test(evidence) || k.test.test(cls));
  findings.push({ cls, set, evidence: evidence.slice(0, 300), where, ...(known ? { known: known.tag } : {}) });
}

// ---------------------------------------------------------------------------
// STAGE A — the batch pass (repo scope): propose → referee → 4 emitters
// ---------------------------------------------------------------------------

interface BaseRecord {
  setName: string;
  type: string;
  tier: Tier | 'S'; // 'S' = singles sample
  proposed: boolean;
  skipReason?: string;
  violations: string[];
  emitted: string[];
  emitterRefusals: Array<{ emitter: string; message: string }>;
  notes: number;
  unbound: number;
  minted: number;
  tokenRefs: number;
  factsCarriedPct: number | null;
  degradations: number;
  stubs: number;
  repeatParts: number;
  /** STYLE-FIDELITY B7 receipts: part-level state overrides NAMED, not
   *  proposed (Part.states P18 fix in flight on the parallel worktree). */
  b7Notes: number;
  clean: boolean;
  internalError?: string;
}

const TOKEN_REF = /"\{[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)*\}"/gi;
const batch = proposeBatchFromDump(dump, {
  corpus,
  contractIdByName: loaded.byName,
  contractIdByKey: loaded.byKey,
  contractsById: loaded.byId,
  fileKey: provenance?.fileKey ?? null,
  mintUnbound: true,
  hiddenCaptured,
});
const proposalsBySet = new Map(batch.proposals.map((p) => [p.setName, p]));
const skippedBySet = new Map(batch.skipped.map((s) => [s.setName, s]));

const degradationCountBySet = new Map<string, number>();
for (const d of (dump._degradations as Array<{ nodePath: string }> | undefined) ?? []) {
  const setName = d.nodePath.slice(0, d.nodePath.indexOf(':'));
  degradationCountBySet.set(setName, (degradationCountBySet.get(setName) ?? 0) + 1);
}

/** Referee + emit a proposal against a given contracts scope; returns the
 *  violations, surfaces, and the parsed contract (census semantics). */
function refereeAndEmit(
  proposal: NonNullable<ReturnType<typeof proposalsBySet.get>>,
  extraContracts: Map<string, Contract>,
  extraMintedTrees: Record<string, unknown>[],
): { contract: Contract | null; violations: string[]; emitted: string[]; refusals: Array<{ emitter: string; message: string }>; stubs: number } {
  const parsed = ContractSchema.safeParse(proposal.contract);
  if (!parsed.success) {
    return {
      contract: null,
      violations: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
      emitted: [],
      refusals: [],
      stubs: 0,
    };
  }
  const contract = parsed.data;
  const contracts = new Map(repoContracts);
  for (const [id, c] of extraContracts) contracts.set(id, c);
  contracts.set(contract.id, contract);
  let stubs = 0;
  for (const raw of proposal.childStubs ?? []) {
    const stub = ContractSchema.safeParse(raw);
    if (stub.success) {
      stubs += 1;
      if (!contracts.has(stub.data.id)) contracts.set(stub.data.id, stub.data);
    }
  }
  const mintedTree = (proposal.mintedTokens?.tree ?? {}) as Record<string, unknown>;
  const inventory = new Set<string>([...baseInventory, ...flattenTokens(mintedTree).keys()]);
  for (const tree of extraMintedTrees) for (const k of flattenTokens(tree).keys()) inventory.add(k);
  const errors: string[] = [];
  validateContract(contract, contracts, errors, icons);
  generateCss(contract, inventory, errors);

  const tokens: TokenTreeInput = {
    ...repoTrees,
    semantic: mergeTrees([baseSemantic, ...extraMintedTrees, mintedTree]),
    brands,
  };
  const ctx: EmitterCtx = { tokens, icons, contracts, fileKey: provenance?.fileKey ?? undefined, mintedTokens: mintedTree };
  const emitted: string[] = [];
  const refusals: Array<{ emitter: string; message: string }> = [];
  for (const emitter of emitters) {
    try {
      emitter.emit(contract, ctx);
      emitted.push(emitter.name);
    } catch (e) {
      refusals.push({ emitter: emitter.name, message: (e instanceof Error ? e.message : String(e)).split('\n').slice(0, 2).join(' ') });
    }
  }
  return { contract, violations: errors, emitted, refusals, stubs };
}

const baseRecords: BaseRecord[] = [];
const baseByName = new Map<string, BaseRecord>();
const contractsBySet = new Map<string, Contract>();
const subjectNames = [...tiers.map((t) => t.setName), ...singles, 'RadioButton'];

for (const setName of subjectNames) {
  const set = sets.get(setName);
  if (!set) continue;
  const tier: Tier | 'S' = tierByName.get(setName)?.tier ?? 'S';
  const rec: BaseRecord = {
    setName,
    type: set.type,
    tier,
    proposed: false,
    violations: [],
    emitted: [],
    emitterRefusals: [],
    notes: 0,
    unbound: 0,
    minted: 0,
    tokenRefs: 0,
    factsCarriedPct: null,
    degradations: degradationCountBySet.get(setName) ?? 0,
    stubs: 0,
    repeatParts: 0,
    b7Notes: 0,
    clean: false,
  };
  try {
    const skip = skippedBySet.get(setName);
    if (skip) {
      rec.skipReason = skip.reason;
      addFinding('propose-skip', setName, skip.reason, 'core/propose-figma.ts proposeFromDump');
    } else {
      const proposal = proposalsBySet.get(setName);
      if (!proposal) throw new Error('set neither proposed nor skipped — batch invariant broken');
      rec.proposed = true;
      rec.notes = proposal.notes.length;
      rec.unbound = proposal.unbound.length;
      rec.minted = proposal.mintedTokens?.count ?? 0;
      rec.tokenRefs = (JSON.stringify(proposal.contract).match(TOKEN_REF) ?? []).length;
      rec.repeatParts = (JSON.stringify(proposal.contract).match(/"repeat":/g) ?? []).length;
      const b7 = proposal.notes.filter((n) => n.includes('part-level state overrides are outside the contract vocabulary'));
      rec.b7Notes = b7.length;
      if (b7.length > 0) {
        addFinding('disabled-part-label-b7', setName, b7[0], 'core/propose-figma.ts proposeStateDiffs — pre-P18 vocabulary (Part.states lands on the parallel worktree)');
      }
      rec.factsCarriedPct =
        rec.tokenRefs + rec.unbound > 0 ? Math.round((100 * rec.tokenRefs) / (rec.tokenRefs + rec.unbound)) : null;
      const r = refereeAndEmit(proposal, new Map(), []);
      rec.violations = r.violations;
      rec.emitted = r.emitted;
      rec.emitterRefusals = r.refusals;
      rec.stubs = r.stubs;
      if (r.contract) contractsBySet.set(setName, r.contract);
      for (const v of r.violations) addFinding('referee-violation', setName, v, 'core/emit-react.ts validateContract/generateCss');
      for (const f of r.refusals) addFinding(`emitter-refusal:${f.emitter}`, setName, f.message, `core emitter ${f.emitter}`);
    }
  } catch (e) {
    rec.internalError = e instanceof Error ? e.message : String(e);
    addFinding('gauntlet-internal-error', setName, rec.internalError, 'gauntlet.ts stage A');
  }
  rec.clean = rec.proposed && rec.violations.length === 0 && rec.emitted.length === emitters.length && !rec.internalError;
  baseRecords.push(rec);
  baseByName.set(setName, rec);
}

// ---------------------------------------------------------------------------
// STAGE B — T2 controls: every enum × boolean combo compiles (markup + CSS
// per combo via emit-html; canvas spec grid via compileComponentData)
// ---------------------------------------------------------------------------

interface ComboRecord {
  setName: string;
  combos: number;
  comboCap: boolean;
  htmlOk: number;
  htmlFailures: Array<{ combo: string; error: string }>;
  canvasOk: boolean;
  canvasVariantSpecs: number;
  canvasError?: string;
}
const comboRecords: ComboRecord[] = [];

function comboSpace(contract: Contract): Array<Record<string, string | boolean>> {
  const enums = contract.props.filter((p) => typeof p.type === 'object' && 'enum' in p.type) as Array<{
    name: string;
    type: { enum: string[] };
  }>;
  const bools = contract.props.filter((p) => p.type === 'boolean').map((p) => p.name);
  let combos: Array<Record<string, string | boolean>> = [{}];
  for (const e of enums) {
    combos = combos.flatMap((c) => e.type.enum.map((v) => ({ ...c, [e.name]: v })));
    if (combos.length > COMBO_CAP) return combos.slice(0, COMBO_CAP);
  }
  for (const b of bools) {
    combos = combos.flatMap((c) => [
      { ...c, [b]: false },
      { ...c, [b]: true },
    ]);
    if (combos.length > COMBO_CAP) return combos.slice(0, COMBO_CAP);
  }
  return combos;
}

for (const t of tiers.filter((t) => t.tier === 'T2')) {
  const contract = contractsBySet.get(t.setName);
  const proposal = proposalsBySet.get(t.setName);
  if (!contract || !proposal) continue;
  const rec: ComboRecord = { setName: t.setName, combos: 0, comboCap: false, htmlOk: 0, htmlFailures: [], canvasOk: false, canvasVariantSpecs: 0 };
  try {
    const contracts = new Map(repoContracts);
    contracts.set(contract.id, contract);
    for (const raw of proposal.childStubs ?? []) {
      const stub = ContractSchema.safeParse(raw);
      if (stub.success && !contracts.has(stub.data.id)) contracts.set(stub.data.id, stub.data);
    }
    const mintedTree = (proposal.mintedTokens?.tree ?? {}) as Record<string, unknown>;
    const inventory = new Set<string>([...baseInventory, ...flattenTokens(mintedTree).keys()]);
    const combos = comboSpace(contract);
    rec.combos = combos.length;
    rec.comboCap = combos.length >= COMBO_CAP;
    for (const combo of combos) {
      const clone = structuredClone(contract);
      for (const prop of clone.props) if (prop.name in combo) prop.default = combo[prop.name];
      try {
        emitHtml(clone, { tokens: inventory, icons, contracts });
        rec.htmlOk += 1;
      } catch (e) {
        const error = (e instanceof Error ? e.message : String(e)).split('\n')[0];
        rec.htmlFailures.push({ combo: JSON.stringify(combo), error });
        if (rec.htmlFailures.length >= 5) break;
      }
    }
    try {
      const engine = createFigmaEngine({
        tokens: { ...repoTrees, semantic: mergeTrees([baseSemantic, mintedTree]), brands },
        icons,
      });
      const data = engine.compileComponentData(contract, contracts);
      rec.canvasVariantSpecs = (data as { variants?: unknown[] }).variants?.length ?? 0;
      rec.canvasOk = true;
    } catch (e) {
      rec.canvasError = (e instanceof Error ? e.message : String(e)).split('\n')[0];
      addFinding('t2-canvas-compile', t.setName, rec.canvasError, 'core/emit-figma-script.ts compileComponentData');
    }
    for (const f of rec.htmlFailures) {
      addFinding('t2-combo-html', t.setName, `${f.combo}: ${f.error}`, 'core/emit-html.ts at combo defaults');
    }
  } catch (e) {
    addFinding('gauntlet-internal-error', t.setName, e instanceof Error ? e.message : String(e), 'gauntlet.ts stage B');
  }
  comboRecords.push(rec);
}

// ---------------------------------------------------------------------------
// STAGE C — state-axis promotion correctness (mechanical, every set with a
// state-like axis, whatever its tier)
// ---------------------------------------------------------------------------

interface PromotionRecord {
  setName: string;
  tier: Tier;
  axis: string;
  axisValues: string[];
  /** Values outside the shipped interaction-state vocabulary — the axis is
   *  EXPECTED to stay an enum prop (the documented near-miss path). */
  outOfVocab: string[];
  expected: 'promote' | 'near-miss-enum';
  statePropInApi: string | null;
  statesCarried: string[];
  drawnDisabled: boolean;
  disabledBoolean: string | null;
  nearMissNoteNamed: boolean;
  ok: boolean;
}
const promotionRecords: PromotionRecord[] = [];
const STATE_PROP = /^(state|status|interaction)$/i;
/** The proposer's interaction-state vocabulary (its own near-miss note names
 *  this list verbatim). */
const STATE_VOCAB = new Set(['default', 'hover', 'focus', 'focus-visible', 'active', 'pressed', 'disabled']);

for (const t of tiers.filter((t) => t.stateAxes.length > 0)) {
  const contract = contractsBySet.get(t.setName);
  const proposal = proposalsBySet.get(t.setName);
  if (!contract || !proposal) continue;
  for (const axis of t.stateAxes) {
    const values = t.axes[axis] ?? [];
    const outOfVocab = values.filter((v) => !STATE_VOCAB.has(v.toLowerCase()));
    const expected: 'promote' | 'near-miss-enum' = outOfVocab.length === 0 ? 'promote' : 'near-miss-enum';
    const stateProp = contract.props.find((p) => STATE_PROP.test(p.name))?.name ?? null;
    const states = contract.states ?? [];
    const drawnDisabled = values.some((v) => v.toLowerCase() === 'disabled');
    const disabledBoolean =
      contract.props.find((p) => p.type === 'boolean' && /^(disabled|isdisabled)$/i.test(p.name))?.name ?? null;
    const nearMissNoteNamed = proposal.notes.some(
      (n) => n.includes(`variant axis "${axis}"`) && n.includes('outside the interaction-state vocabulary'),
    );
    const noOverrideNamed = proposal.notes.some(
      (n) => n.includes('promoted from the axis but no root override was recoverable'),
    );
    let ok: boolean;
    let evidence = '';
    if (expected === 'promote') {
      ok = stateProp === null && (states.length > 0 || noOverrideNamed) && (!drawnDisabled || disabledBoolean !== null);
      if (!ok) {
        evidence = [
          stateProp !== null ? `state-like prop "${stateProp}" survives in the API` : null,
          states.length === 0 && !noOverrideNamed ? 'contract.states empty and no named no-override note' : null,
          drawnDisabled && !disabledBoolean ? 'axis draws "disabled" but no boolean disabled prop proposed' : null,
        ]
          .filter(Boolean)
          .join('; ');
      }
    } else {
      // Near-miss: the shipped rule KEEPS the axis as an enum prop and NAMES
      // the out-of-vocabulary values. Correct = prop kept + note present.
      ok = stateProp !== null && nearMissNoteNamed;
      if (!ok) {
        evidence = `out-of-vocab values [${outOfVocab.join(', ')}] but ${
          stateProp === null ? 'the axis did NOT stay a prop' : 'no near-miss note names them'
        }`;
      }
    }
    if (!ok) {
      addFinding(
        't3-state-promotion',
        t.setName,
        `${axis}=[${values.join(', ')}] (expected ${expected}): ${evidence}`,
        'core/propose-figma.ts state promotion',
      );
    }
    promotionRecords.push({
      setName: t.setName,
      tier: t.tier,
      axis,
      axisValues: values,
      outOfVocab,
      expected,
      statePropInApi: stateProp,
      statesCarried: states,
      drawnDisabled,
      disabledBoolean,
      nearMissNoteNamed,
      ok,
    });
  }
}

// ---------------------------------------------------------------------------
// STAGE C2 — duplicate-name key contradictions (capture-level truth): nested
// instances whose captured keys CONTRADICT the same-named set the name-keyed
// dump kept — the 1,514-duplicate-name roster made these unlinkable by
// design (resolveChildContract refuses a name match with contradicting keys,
// honestly), so sessions stub where the owner expects a link.
// ---------------------------------------------------------------------------

interface KeyContradiction {
  setName: string;
  instanceOf: string;
  capturedKey: string;
  dumpSetKey: string;
  occurrences: number;
}
const keyContradictions: KeyContradiction[] = [];
{
  const agg = new Map<string, KeyContradiction>();
  for (const t of tiers) {
    const set = sets.get(t.setName);
    if (!set) continue;
    const walk = (node: { type?: string; instanceOf?: string; instanceKey?: string; instanceSetKey?: string; children?: unknown[] }): void => {
      if (node.type === 'INSTANCE' && node.instanceOf && sets.has(node.instanceOf)) {
        const target = sets.get(node.instanceOf)!;
        const captured = node.instanceSetKey ?? node.instanceKey;
        // A set-keyed instance compares against the set key; a setless
        // COMPONENT compares its component key. Missing keys stay silent
        // (pre-v1.5 shapes) — absence is never evidence.
        const comparable = node.instanceSetKey !== undefined || target.type !== 'COMPONENT_SET';
        if (captured !== undefined && comparable && target.key && captured !== target.key) {
          const k = `${t.setName}→${node.instanceOf}`;
          const cur = agg.get(k);
          if (cur) cur.occurrences += 1;
          else agg.set(k, { setName: t.setName, instanceOf: node.instanceOf, capturedKey: captured, dumpSetKey: target.key, occurrences: 1 });
        }
      }
      for (const c of (node.children as typeof node[]) ?? []) walk(c);
    };
    for (const v of set.variants) walk(v as never);
  }
  keyContradictions.push(...agg.values());
  for (const kc of keyContradictions) {
    addFinding(
      'duplicate-name-key-contradiction',
      kc.setName,
      `nested "${kc.instanceOf}" ×${kc.occurrences} carries key ${kc.capturedKey.slice(0, 10)}… but the name-keyed dump kept the copy with key ${kc.dumpSetKey.slice(0, 10)}… (the file draws duplicate-named components; the dump format collapses them last-wins, so the drawn parent of these instances is NOT in the dump and sessions stub honestly)`,
      'capture convention: dump.plugin.js name-keyed records + resolveChildContract key refusal',
    );
  }
}

// ---------------------------------------------------------------------------
// STAGE D — simulated sessions (T4 + T5 composites): children-first LINKS,
// adversarial parent-first STUBS then self-heals
// ---------------------------------------------------------------------------

interface Session {
  contracts: Map<string, Contract>;
  byIdMinimal: Map<string, MinimalChildContract>;
  idByName: Map<string, string>;
  idByKey: Map<string, string>;
  mintedTrees: Record<string, unknown>[];
  contractSetByName: Map<string, string>; // contract id → drawn set name
}
const newSession = (): Session => ({
  contracts: new Map(),
  byIdMinimal: new Map(),
  idByName: new Map(),
  idByKey: new Map(),
  mintedTrees: [],
  contractSetByName: new Map(),
});

interface ImportResult {
  setName: string;
  ok: boolean;
  error?: string;
  contract?: Contract;
  violations: string[];
  refs: Array<{ refId: string; resolution: 'linked-session' | 'linked-repo' | 'stubbed' | 'unresolved'; targetSet?: string }>;
  stubIds: string[];
  stubGeometryMints: number;
  /** Proposer notes naming the stub-geometry mint SKIP ("resolved values
   *  differ across variants without correlating to any variant axis") — the
   *  197dd02 parent-axis-correlated stub geometry limit, counted live. */
  geometrySkipNotes: number;
}

function importSet(session: Session, setName: string): ImportResult {
  const set = sets.get(setName);
  const out: ImportResult = { setName, ok: false, violations: [], refs: [], stubIds: [], stubGeometryMints: 0, geometrySkipNotes: 0 };
  if (!set) {
    out.error = `set "${setName}" not in dump`;
    return out;
  }
  try {
    const proposal = proposeFromDump(set as never, {
      corpus,
      contractIdByName: new Map([...loaded.byName, ...session.idByName]),
      contractIdByKey: new Map([...loaded.byKey, ...session.idByKey]),
      contractsById: new Map([...loaded.byId, ...session.byIdMinimal]),
      fileKey: provenance?.fileKey ?? null,
      mintUnbound: true,
      hiddenCaptured,
    });
    const parsed = ContractSchema.safeParse(proposal.contract);
    if (!parsed.success) {
      out.error = `contract schema: ${parsed.error.issues[0]?.message ?? '?'}`;
      return out;
    }
    const contract = parsed.data;
    out.contract = contract;
    const stubIds = new Set<string>();
    for (const raw of proposal.childStubs ?? []) {
      const id = (raw as { id?: unknown }).id;
      if (typeof id === 'string') stubIds.add(id);
    }
    out.stubIds = [...stubIds];
    const mintedTree = (proposal.mintedTokens?.tree ?? {}) as Record<string, unknown>;
    out.stubGeometryMints = [...flattenTokens(mintedTree).keys()].filter((k) => k.includes('.stub-')).length;
    out.geometrySkipNotes = proposal.notes.filter((n) => n.includes('without correlating to any variant axis')).length;

    // Linked-vs-stubbed classification per component ref.
    for (const { ref } of componentRefsOf(contract)) {
      const refId = ref.id;
      const resolution = session.contracts.has(refId)
        ? ('linked-session' as const)
        : repoContracts.has(refId)
          ? ('linked-repo' as const)
          : stubIds.has(refId)
            ? ('stubbed' as const)
            : ('unresolved' as const);
      out.refs.push({ refId, resolution, targetSet: session.contractSetByName.get(refId) });
    }

    // Referee in session scope (playground validate semantics: session
    // contracts + stubs at lower precedence; session minted trees resolve
    // linked children's imported.* bindings).
    const scope = new Map<string, Contract>(session.contracts);
    const r = refereeAndEmit(
      { ...proposal, setName } as never,
      scope,
      [...session.mintedTrees],
    );
    out.violations = r.violations;

    // Register in the session (newest wins — the workspace re-import rule).
    session.contracts.set(contract.id, contract);
    session.byIdMinimal.set(contract.id, contract as unknown as MinimalChildContract);
    session.idByName.set(contract.name, contract.id);
    session.idByName.set(setName, contract.id);
    const key = contract.anchors.figma.componentSetKey;
    if (key) session.idByKey.set(key, contract.id);
    if (mintedTree && Object.keys(mintedTree).length > 0) session.mintedTrees.push(mintedTree);
    session.contractSetByName.set(contract.id, setName);
    out.ok = true;
  } catch (e) {
    out.error = e instanceof Error ? e.message.split('\n').slice(0, 2).join(' ') : String(e);
  }
  return out;
}

/** Recursive dependency closure (childSets over the dump), leaf-first. */
function depOrder(setName: string): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const visit = (name: string, chain: Set<string>): void => {
    if (seen.has(name) || chain.has(name)) return; // cycle → drawn order wins
    const t = tierByName.get(name);
    const deps = t ? t.childSets : [];
    for (const dep of deps) visit(dep, new Set([...chain, name]));
    seen.add(name);
    order.push(name);
  };
  const t = tierByName.get(setName);
  for (const dep of t?.childSets ?? []) visit(dep, new Set([setName]));
  return order;
}

interface SessionRecord {
  setName: string;
  tier: Tier;
  deps: string[];
  childrenFirst: {
    importedDeps: string[];
    failedDeps: Array<{ set: string; error: string }>;
    parentOk: boolean;
    parentError?: string;
    linkedSession: number;
    linkedRepo: number;
    stubbed: number;
    unresolved: number;
    /** THE assertion: refs that stubbed even though their set imported earlier. */
    stubbedDespiteImported: string[];
    violations: string[];
    crossImportMintedExposure?: number;
  };
  adversarial: {
    parentFirstStubs: number;
    stubGeometryMints: number;
    geometrySkipNotes: number;
    healedAfterReimport: boolean | null;
    stillStubbedAfterHeal: string[];
    firstChild?: string;
    error?: string;
  };
}
const sessionRecords: SessionRecord[] = [];

/** The contract id a set's proposal/stub claims (componentIdSlug — the
 *  stubIdFor discipline) — EXACT match; suffix matching would alias "Square"
 *  onto ds.minus-square (the first-run harness bug, kept named here). */
const idForSet = (setName: string): string => `ds.${componentIdSlug(setName)}`;

for (const t of tiers.filter((t) => t.tier === 'T4' || t.tier === 'T5')) {
  if (t.childSets.length === 0) continue;
  const rec: SessionRecord = {
    setName: t.setName,
    tier: t.tier,
    deps: depOrder(t.setName),
    childrenFirst: {
      importedDeps: [],
      failedDeps: [],
      parentOk: false,
      linkedSession: 0,
      linkedRepo: 0,
      stubbed: 0,
      unresolved: 0,
      stubbedDespiteImported: [],
      violations: [],
    },
    adversarial: { parentFirstStubs: 0, stubGeometryMints: 0, geometrySkipNotes: 0, healedAfterReimport: null, stillStubbedAfterHeal: [] },
  };
  try {
    // --- children-first ---
    const session = newSession();
    for (const dep of rec.deps) {
      const r = importSet(session, dep);
      if (r.ok) rec.childrenFirst.importedDeps.push(dep);
      else rec.childrenFirst.failedDeps.push({ set: dep, error: r.error ?? '?' });
    }
    const parent = importSet(session, t.setName);
    rec.childrenFirst.parentOk = parent.ok;
    rec.childrenFirst.parentError = parent.error;
    rec.childrenFirst.violations = parent.violations;
    for (const ref of parent.refs) {
      if (ref.resolution === 'linked-session') rec.childrenFirst.linkedSession += 1;
      else if (ref.resolution === 'linked-repo') rec.childrenFirst.linkedRepo += 1;
      else if (ref.resolution === 'stubbed') rec.childrenFirst.stubbed += 1;
      else rec.childrenFirst.unresolved += 1;
      if (ref.resolution === 'stubbed') {
        // Did the stubbed ref's set import earlier? Match by the stub slug —
        // the stub id derives from the drawn set name (stubIdFor).
        const imported = rec.childrenFirst.importedDeps.find((d) => ref.refId === idForSet(d));
        if (imported) rec.childrenFirst.stubbedDespiteImported.push(`${ref.refId} (set "${imported}" imported earlier)`);
      }
    }
    // Cross-import minted-token scope (fix in flight): the PLAYGROUND's
    // single on-screen minted layer carries only the current contract's
    // mints — a linked child's imported.* CSS vars resolve ONLY if the
    // session's minted trees also reach the document. Measure the exposure:
    // imported.* vars the parent's emitted doc USES that only a session
    // sibling's tree defines.
    if (parent.contract) {
      try {
        const contracts = new Map(repoContracts);
        for (const [id, c] of session.contracts) contracts.set(id, c);
        contracts.set(parent.contract.id, parent.contract);
        const parentProposal = proposalsBySet.get(t.setName);
        for (const raw of parentProposal?.childStubs ?? []) {
          const stub = ContractSchema.safeParse(raw);
          if (stub.success && !contracts.has(stub.data.id)) contracts.set(stub.data.id, stub.data);
        }
        const parentMinted = (parentProposal?.mintedTokens?.tree ?? {}) as Record<string, unknown>;
        const inventory = new Set<string>([...baseInventory, ...flattenTokens(parentMinted).keys()]);
        for (const tree of session.mintedTrees) for (const k of flattenTokens(tree).keys()) inventory.add(k);
        const emitted = emitHtml(parent.contract, { tokens: inventory, icons, contracts });
        const usedImported = new Set(
          [...`${emitted.html}\n${emitted.css}`.matchAll(/var\(--(imported-[a-z0-9-]+)/g)].map((m) => m[1]),
        );
        const cssVarNamesOf = (tree: Record<string, unknown>) =>
          new Set([...mintedTokenCss(tree).matchAll(/--(imported-[a-z0-9-]+):/g)].map((m) => m[1]));
        const parentDefined = cssVarNamesOf(parentMinted);
        const sessionDefined = new Set<string>();
        for (const tree of session.mintedTrees) for (const v of cssVarNamesOf(tree)) sessionDefined.add(v);
        const exposure = [...usedImported].filter((v) => !parentDefined.has(v) && sessionDefined.has(v));
        rec.childrenFirst.crossImportMintedExposure = exposure.length;
        if (exposure.length > 0) {
          addFinding(
            'cross-import-minted-token-scope',
            t.setName,
            `parent doc uses ${exposure.length} imported.* var(s) only a session sibling's minted tree defines (e.g. --${exposure[0]}) — the playground's single on-screen minted layer would leave them unresolved`,
            'playground token-source single minted layer (session-registry mintedTrees is the fix seam)',
          );
        }
      } catch {
        /* exposure probe is best-effort — emit failures already recorded */
      }
    }
    for (const s of rec.childrenFirst.stubbedDespiteImported) {
      addFinding('t4-stub-despite-import', t.setName, s, 'core/propose-figma.ts resolveChildContract / session indexes');
    }
    for (const v of parent.violations) {
      addFinding(
        v.includes('cannot compose itself')
          ? 'session-id-collision-false-cycle'
          : 't4-session-referee',
        t.setName,
        v,
        v.includes('cannot compose itself')
          ? 'core/propose-figma.ts stubIdFor/selfContractId — cross-population id collision (RadioButton the COMPONENT vs "Radio button" the set claim ds.radio-button; the session newest-wins registry rebinds the child\'s ref onto the parent)'
          : 'session-scope referee (validateContract/generateCss)',
      );
    }

    // --- adversarial: parent first ---
    const adv = newSession();
    const p1 = importSet(adv, t.setName);
    rec.adversarial.parentFirstStubs = p1.stubIds.length;
    rec.adversarial.stubGeometryMints = p1.stubGeometryMints;
    rec.adversarial.geometrySkipNotes = p1.geometrySkipNotes;
    if (p1.stubIds.length > 0 && p1.stubGeometryMints === 0 && p1.geometrySkipNotes > 0) {
      addFinding(
        'stub-geometry-not-minted',
        t.setName,
        `${p1.stubIds.length} stub(s) mint ZERO observed-geometry tokens; ${p1.geometrySkipNotes} note(s) say values differ "without correlating to any variant axis" — yet e.g. Checkbox-icon's 24/16px track size=large/small EXACTLY (the correlation is with the PARENT's axis, which the stub mint pass does not consult)`,
        'core/propose-figma.ts stub mint pass (197dd02 named limit, quantified live)',
      );
    }
    // Heal path: import the first dep that stubbed, then re-import the parent.
    const stubbedDep = rec.deps.find((d) => p1.stubIds.includes(idForSet(d)));
    if (stubbedDep) {
      rec.adversarial.firstChild = stubbedDep;
      importSet(adv, stubbedDep);
      const p2 = importSet(adv, t.setName);
      const stillStubbed = p2.refs.filter(
        (r) => r.resolution === 'stubbed' && r.refId === idForSet(stubbedDep),
      );
      rec.adversarial.healedAfterReimport = p2.ok && stillStubbed.length === 0;
      rec.adversarial.stillStubbedAfterHeal = stillStubbed.map((r) => r.refId);
      if (!rec.adversarial.healedAfterReimport) {
        addFinding(
          't4-self-heal-failed',
          t.setName,
          `after importing "${stubbedDep}" and re-importing, refs still stubbed: ${stillStubbed.map((r) => r.refId).join(', ') || `(parent re-import ${p2.ok ? 'ok' : `failed: ${p2.error}`})`}`,
          'core/propose-figma.ts resolveChildContract (key-first, name fallback)',
        );
      }
    }
  } catch (e) {
    addFinding('gauntlet-internal-error', t.setName, e instanceof Error ? e.message : String(e), 'gauntlet.ts stage D');
  }
  sessionRecords.push(rec);
}

// ---------------------------------------------------------------------------
// STAGE E — T5 specials
// ---------------------------------------------------------------------------

interface T5Record {
  exercise: string;
  ok: boolean;
  detail: string;
}
const t5Records: T5Record[] = [];

// E1: repeat collections (Navigation-Header, _Nav-item-menu) — schema v12
// repeat part + code-only arrayOf prop.
for (const setName of ['Navigation-Header', '_Nav-item-menu']) {
  const contract = contractsBySet.get(setName);
  const rec = baseByName.get(setName);
  if (!contract || !rec) {
    t5Records.push({ exercise: `repeat:${setName}`, ok: false, detail: 'no contract proposed' });
    continue;
  }
  const hasRepeat = rec.repeatParts > 0;
  const arrayOfProps = contract.props.filter((p) => typeof p.type === 'object' && 'arrayOf' in (p.type as object));
  const ok = hasRepeat && arrayOfProps.length > 0;
  if (!ok)
    addFinding(
      't5-repeat-collection',
      setName,
      `repeat parts: ${rec.repeatParts}; arrayOf props: ${arrayOfProps.length}`,
      'core/propose-figma.ts repeatRunAt/buildRepeatPart',
    );
  t5Records.push({
    exercise: `repeat:${setName}`,
    ok,
    detail: `repeat parts ${rec.repeatParts}, arrayOf props [${arrayOfProps.map((p) => p.name).join(', ')}]`,
  });
}

// E2: slot sets — INSTANCE_SWAP refs / _Slot-* placeholders → slot parts with
// accepts (swapPreferredValues resolve where the keys are in scope).
for (const setName of ['Dialog', 'Card-Image', 'Card-Basic', 'List item', '_Text-block-Panel', 'Icon']) {
  const contract = contractsBySet.get(setName);
  const set = sets.get(setName);
  if (!contract || !set) {
    t5Records.push({ exercise: `slot:${setName}`, ok: false, detail: 'no contract proposed' });
    continue;
  }
  const slots = slotsOf(contract);
  const withAccepts = slots.filter((s) => (s.slot.accepts ?? []).length > 0);
  const prefer = Object.keys(set.swapPreferredValues ?? {});
  const ok = slots.length > 0;
  if (!ok)
    addFinding(
      't5-slot-missing',
      setName,
      `drawn swaps/placeholders but proposal carries 0 slot parts (swapPreferredValues: ${prefer.join(', ') || 'none'})`,
      'core/propose-figma.ts INSTANCE_SWAP/slot branch',
    );
  t5Records.push({
    exercise: `slot:${setName}`,
    ok,
    detail: `${slots.length} slot part(s) [${slots.map((s) => s.slot.name).join(', ')}], ${withAccepts.length} with accepts; drawn prefer-keys on [${prefer.join(', ') || '—'}]`,
  });
}

// E3: id collision — RadioButton (plain COMPONENT) vs "Radio button" (set):
// both must propose, the batch must NAME the collision, never merge.
{
  const note = batch.notes.find((n) => n.includes('ds.radio-button'));
  const both = baseByName.get('RadioButton')?.proposed && baseByName.get('Radio button')?.proposed;
  const ok = !!note && !!both;
  if (!ok)
    addFinding(
      't5-id-collision',
      'RadioButton / Radio button',
      note ? 'collision note present but a side failed to propose' : 'no batch note names the ds.radio-button collision',
      'core/propose-figma.ts proposeBatchFromDump claimedIds',
    );
  t5Records.push({
    exercise: 'id-collision:RadioButton/Radio button',
    ok,
    detail: note ? `named: "${note.slice(0, 140)}…"` : 'NOT NAMED',
  });
}

// E4: MEGA-SESSION — 10 sets, mixed order (composites before some of their
// children on purpose), then a relink pass re-importing every composite.
{
  const MEGA_ORDER = [
    'List item', // before Icon/Avatar/Badge — stubs expected
    'Icon',
    'Button-Brand Primary',
    'Dialog', // after Button — action links; before Card slots
    'Menu',
    'Avatar',
    'Badge',
    'Card-Image',
    'Chip',
    'Navigation-Header',
  ];
  const mega = newSession();
  const firstPass: Record<string, { linkedSession: number; stubbed: number }> = {};
  const relink: Record<string, { linkedSession: number; stubbed: number; stubbedDespiteInScope: string[] }> = {};
  let internalError: string | undefined;
  try {
    for (const name of MEGA_ORDER) {
      const r = importSet(mega, name);
      firstPass[name] = {
        linkedSession: r.refs.filter((x) => x.resolution === 'linked-session').length,
        stubbed: r.refs.filter((x) => x.resolution === 'stubbed').length,
      };
      if (!r.ok) addFinding('t5-mega-import-failed', name, r.error ?? '?', 'gauntlet.ts mega-session');
    }
    // Relink pass: every composite re-imported now that the whole scope exists.
    for (const name of MEGA_ORDER) {
      if ((tierByName.get(name)?.childSets.length ?? 0) === 0) continue;
      const r = importSet(mega, name);
      const inScope = new Set(MEGA_ORDER.filter((n) => mega.idByName.has(n)));
      const stubbedDespite = r.refs
        .filter((x) => x.resolution === 'stubbed')
        .filter((x) => [...inScope].some((n) => x.refId === idForSet(n)))
        .map((x) => x.refId);
      relink[name] = {
        linkedSession: r.refs.filter((x) => x.resolution === 'linked-session').length,
        stubbed: r.refs.filter((x) => x.resolution === 'stubbed').length,
        stubbedDespiteInScope: stubbedDespite,
      };
      for (const s of stubbedDespite) {
        addFinding('t5-mega-stub-despite-scope', name, `${s} still stubbed with its set in scope`, 'core/propose-figma.ts resolveChildContract');
      }
    }
  } catch (e) {
    internalError = e instanceof Error ? e.message : String(e);
    addFinding('gauntlet-internal-error', 'MEGA-SESSION', internalError, 'gauntlet.ts stage E4');
  }
  const totalStubbedDespite = Object.values(relink).reduce((a, r) => a + r.stubbedDespiteInScope.length, 0);
  t5Records.push({
    exercise: 'mega-session',
    ok: !internalError && totalStubbedDespite === 0,
    detail: `first pass: ${JSON.stringify(firstPass)}; relink: ${JSON.stringify(relink)}`,
  });
  writeFileSync(path.join(HERE, 'mega-session.json'), JSON.stringify({ order: MEGA_ORDER, firstPass, relink }, null, 2));
}

// ---------------------------------------------------------------------------
// Fixtures — one self-contained single-set slice per NEW failure class
// (census fixture conventions: _variables slice + _degradations slice).
// ---------------------------------------------------------------------------

function varNamesOf(set: unknown): Set<string> {
  const names = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (typeof o.var === 'string') names.add(o.var);
    if (typeof o.fillVar === 'string') names.add(o.fillVar);
    if (o.bound && typeof o.bound === 'object') {
      for (const v of Object.values(o.bound as Record<string, unknown>)) if (typeof v === 'string') names.add(v);
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(set);
  return names;
}

mkdirSync(FIXTURE_DIR, { recursive: true });
const allVariables = (dump._variables ?? {}) as Record<string, unknown>;
const allDegradations = (dump._degradations ?? []) as Array<{ code: string; nodePath: string; message: string }>;
const writtenFixtures: Array<{ cls: string; setName: string; file: string }> = [];
function writeClassFixture(cls: string, setName: string): void {
  const set = dump[setName];
  if (!set) return;
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  const file = `${slug(cls)}-${slug(setName)}.dump.json`;
  if (writtenFixtures.some((f) => f.file === file)) return;
  const slice: Record<string, unknown> = {};
  for (const name of varNamesOf(set)) if (name in allVariables) slice[name] = allVariables[name];
  const fixture = {
    _provenance: {
      ...(dump._provenance as Record<string, unknown>),
      note: `Single-set LIVE-GAUNTLET fixture for class "${cls}" — sliced from ${path.basename(DUMP_PATH)} by extract/figma/gauntlet/live/gauntlet.ts.`,
    },
    _degradations: allDegradations.filter((d) => d.nodePath.startsWith(`${setName}:`)),
    _variables: slice,
    [setName]: set,
  };
  writeFileSync(path.join(FIXTURE_DIR, file), JSON.stringify(fixture, null, 1) + '\n');
  writtenFixtures.push({ cls, setName, file });
}
// New classes only: known named limits / fix-in-flight classes carry tags.
const newClasses = new Map<string, Finding>();
for (const f of findings) {
  if (f.known) continue;
  if (!newClasses.has(f.cls)) newClasses.set(f.cls, f);
}
for (const [cls, f] of newClasses) writeClassFixture(cls, f.set);
// The false-cycle class needs the TRIO in one self-contained fixture (the
// single-set slice cannot reproduce a cross-population id collision).
if (newClasses.has('session-id-collision-false-cycle')) {
  const trio = ['Radio button', 'Radio button-icon', 'RadioButton', 'Circle'].filter((n) => sets.has(n));
  const slice: Record<string, unknown> = {};
  for (const n of trio) for (const name of varNamesOf(dump[n])) if (name in allVariables) slice[name] = allVariables[name];
  const fixture: Record<string, unknown> = {
    _provenance: {
      ...(dump._provenance as Record<string, unknown>),
      note: 'Multi-set LIVE-GAUNTLET fixture for class "session-id-collision-false-cycle" — RadioButton (plain COMPONENT) and "Radio button" (set) sanitize to ds.radio-button; importing Radio button-icon then Radio button in one session rebinds the icon\'s ref onto the parent and the referee reports a false cycle.',
    },
    _degradations: allDegradations.filter((d) => trio.some((n) => d.nodePath.startsWith(`${n}:`))),
    _variables: slice,
  };
  for (const n of trio) fixture[n] = dump[n];
  writeFileSync(path.join(FIXTURE_DIR, 'session-id-collision-false-cycle-radio-button.dump.json'), JSON.stringify(fixture, null, 1) + '\n');
  writtenFixtures.push({ cls: 'session-id-collision-false-cycle', setName: trio.join(' + '), file: 'session-id-collision-false-cycle-radio-button.dump.json' });
}

// ---------------------------------------------------------------------------
// gauntlet.json — the machine record (GAUNTLET.md is generated from this by
// report-live.ts so the report regenerates offline too)
// ---------------------------------------------------------------------------

const tierTotals: Record<string, { sets: number; clean: number }> = {};
for (const rec of baseRecords) {
  const k = rec.tier;
  tierTotals[k] = tierTotals[k] ?? { sets: 0, clean: 0 };
  tierTotals[k].sets += 1;
  if (rec.clean) tierTotals[k].clean += 1;
}

const out = {
  _provenance: {
    generatedBy: 'extract/figma/gauntlet/live/gauntlet.ts',
    dump: DUMP_PATH,
    dumpFileVersion: (dump._provenance as { fileVersion?: string })?.fileVersion ?? null,
    generatedAt: new Date().toISOString().slice(0, 10),
  },
  tierTotals,
  tiers: tiers.map((t) => ({ setName: t.setName, tier: t.tier, variants: t.variants, realDeps: t.realDeps, stateAxes: t.stateAxes })),
  singlesSample: singles,
  baseRecords,
  comboRecords,
  promotionRecords,
  sessionRecords,
  keyContradictions,
  t5Records,
  batchNotes: batch.notes,
  findings,
  fixtures: writtenFixtures,
  capturedLayer: captured ? { count: captured.count, registered: capturedRegistered.length, skipped: captured.skipped.length } : null,
};
writeFileSync(path.join(HERE, 'gauntlet.json'), JSON.stringify(out, null, 1) + '\n');

// ---------------------------------------------------------------------------
// stdout scoreboard
// ---------------------------------------------------------------------------

console.log(`\nLIVE GAUNTLET over ${DUMP_PATH}`);
console.log(`sets exercised: ${baseRecords.length} (76 COMPONENT_SETs tiered + ${singles.length} sampled singles + RadioButton)`);
for (const tier of ['T1', 'T2', 'T3', 'T4', 'T5', 'S']) {
  const tt = tierTotals[tier];
  if (tt) console.log(`  ${tier}: ${tt.clean}/${tt.sets} clean`);
}
console.log(`\nT2 combos: ${comboRecords.reduce((a, r) => a + r.htmlOk, 0)}/${comboRecords.reduce((a, r) => a + r.combos, 0)} html-compiled; canvas ${comboRecords.filter((r) => r.canvasOk).length}/${comboRecords.length} sets`);
console.log(`T3 promotion: ${promotionRecords.filter((r) => r.ok).length}/${promotionRecords.length} axes correct (${promotionRecords.filter((r) => r.expected === 'promote').length} promote-expected, ${promotionRecords.filter((r) => r.expected === 'near-miss-enum').length} near-miss-enum)`);
console.log(`key contradictions (duplicate-name collapse): ${keyContradictions.length} parent→child pairs`);
const cf = sessionRecords.map((r) => r.childrenFirst);
console.log(`T4/T5 sessions: ${sessionRecords.length} composites; children-first stub-despite-import: ${cf.reduce((a, r) => a + r.stubbedDespiteImported.length, 0)}; self-heal failures: ${sessionRecords.filter((r) => r.adversarial.healedAfterReimport === false).length}`);
console.log(`T5: ${t5Records.filter((r) => r.ok).length}/${t5Records.length} exercises ok`);
const newFindings = findings.filter((f) => !f.known);
const knownFindings = findings.filter((f) => f.known);
console.log(`\nfindings: ${findings.length} total — ${newFindings.length} NEW, ${knownFindings.length} known (named-limit/fix-in-flight)`);
const byCls = new Map<string, number>();
for (const f of newFindings) byCls.set(f.cls, (byCls.get(f.cls) ?? 0) + 1);
for (const [cls, n] of [...byCls].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${cls}`);
console.log(`\nfixtures: ${writtenFixtures.length} new-class slices under gauntlet/live/fixtures/`);
console.log(`wrote gauntlet.json${writtenFixtures.length ? ' + fixtures' : ''}`);
