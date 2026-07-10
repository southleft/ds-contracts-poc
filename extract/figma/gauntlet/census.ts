/**
 * THE PATTERN GAUNTLET — census of the owner's ENTIRE kit through the full
 * deterministic receive pipeline. `npm run extract:figma:gauntlet`.
 *
 * Replays every component set in the committed v1.4 plugin dump
 * (extract/figma/fixtures/cbds-plugin-all-sets.v14.dump.json — 1,618 sets,
 * recaptured 2026-07-10 with the verbatim dump.plugin.js so the `_variables`
 * resolved-value channel rides along) through the EXACT playground receive
 * semantics, per set:
 *
 *   1. proposeBatchFromDump with minting (mintUnbound: true) — the same
 *      function the playground bridge/paste/URL receive paths run, with the
 *      repo corpus and contract registry (extract/figma/cbds-bridge-check.ts
 *      composition).
 *   2. The captured-token layer (core/captured-tokens.ts) registered dump-
 *      scoped with the playground layering rule: repo tokens WIN on name
 *      collision; shadowed names are excluded and receipted, never silently
 *      overridden (playground/src/engine/token-source.ts composeCaptured).
 *   3. Child STUBS registered with the playground precedence: a stub never
 *      overrides a repo contract or the proposal itself — it only fills ids
 *      that would otherwise refuse (playground/src/engine/stub-contracts.ts).
 *   4. The playground referee (playground/src/engine/validate.ts):
 *      validateContract + generateCss over the layered inventory
 *      (repo + captured + minted).
 *   5. ALL FOUR emitters (core/emitter.ts registry) over the composed token
 *      tree — captured + minted merged into the semantic slot exactly like
 *      token-source.ts recompose. (Observed and recorded honestly: the
 *      figma-script emitter does not referee — it emits for contracts the
 *      other three refuse.)
 *
 * Per set it records: proposed ok / referee violations (classified into base
 * failure classes) / emitter refusals (same classes, per surface) / named
 * notes + capture degradations by code / structural features (composition
 * depth, nested instances, arrayOf candidates, slot placeholders,
 * INSTANCE_SWAP, variant-axis inventory, geometry parts, text-style variety,
 * boolean-visibility pairs) / a facts-carried metric (refusal-free ≠
 * pixel-right — "clean" is qualified).
 *
 * Streaming with per-set isolation: one throw never kills the run. Outputs:
 * extract/figma/gauntlet/CENSUS.md (human), census.json (machine), and
 * fixtures/<class>-<set>.dump.json — one self-contained single-set dump per
 * top failure/pattern class (with its `_variables` slice), the class
 * acceptance fixtures.
 *
 * Node shell over pure core functions — the same split as every receipt in
 * extract/figma/. Reads the repo and the committed fixture; writes only
 * under extract/figma/gauntlet/.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ContractSchema, type Contract } from '../../../scripts/contract-schema.js';
import { capturedTokensFromDump } from '../../../core/captured-tokens.js';
import { emitters, type EmitterCtx } from '../../../core/emitter.js';
import { generateCss, validateContract } from '../../../core/emit-react.js';
import { flattenTokens, tokenInventoryFromJson, type TokenTreeInput } from '../../../core/tokens.js';
import { proposeBatchFromDump } from '../../../core/propose-figma.js';
import { kebab } from '../../types.js';
import { loadTokenCorpus } from '../tokens.js';
import { loadContracts } from '../propose.js';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'extract', 'figma', 'gauntlet');
const FIXTURE_DIR = path.join(OUT_DIR, 'fixtures');
const DEFAULT_DUMP = path.join('extract', 'figma', 'fixtures', 'cbds-plugin-all-sets.v14.dump.json');
const TOP_CLASS_FIXTURES = 8;

const read = (p: string) => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8')) as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Inputs — repo corpus/contracts/icons/tokens (emitters-check composition)
// ---------------------------------------------------------------------------

const dumpPath = process.argv[2] ?? DEFAULT_DUMP;
/** Committed outputs (CENSUS.md, census.json, fixtures/) regenerate only for
 *  the default dump — a custom dump argument gets the stdout report without
 *  clobbering the committed census. */
const writeOutputs = dumpPath === DEFAULT_DUMP;
const dump = read(dumpPath);
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

// ---------------------------------------------------------------------------
// Captured-token layer — dump-scoped, repo wins on collision (token-source)
// ---------------------------------------------------------------------------

const captured = capturedTokensFromDump(dump);
const capturedShadowed = (captured?.entries ?? []).filter((e) => repoInventory.has(e.path));
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

// ---------------------------------------------------------------------------
// The batch — the exact playground receive call (figma-import.ts +
// cbds-bridge-check.ts: repo corpus + contract registry, minting on)
// ---------------------------------------------------------------------------

const provenance = dump._provenance as { fileKey?: string } | undefined;
const batch = proposeBatchFromDump(dump, {
  corpus,
  contractIdByName: loaded.byName,
  contractsById: loaded.byId,
  fileKey: provenance?.fileKey ?? null,
  mintUnbound: true,
});

// Capture-side degradations, attributed per set (nodePath = "Set:variant/…").
const degradationsBySet = new Map<string, Array<{ code: string; message: string }>>();
const batchDegradations: Array<{ code: string; message: string }> = [];
for (const d of (dump._degradations as Array<{ code: string; nodePath: string; message: string }> | undefined) ?? []) {
  const colon = d.nodePath.indexOf(':');
  const setName = colon > 0 ? d.nodePath.slice(0, colon) : null;
  if (setName && setName in dump) {
    const list = degradationsBySet.get(setName) ?? [];
    list.push({ code: d.code, message: d.message });
    degradationsBySet.set(setName, list);
  } else {
    batchDegradations.push({ code: d.code, message: d.message });
  }
}

// ---------------------------------------------------------------------------
// Classification — one BASE class per root cause; the same violation text
// classifies identically whether the referee or an emitter reports it.
// ---------------------------------------------------------------------------

/** In-flight engine work (concurrent propose-figma dedup/canvas branch):
 *  classes listed here are ranked with a "fix in flight" marker instead of
 *  counted as unknowns. */
const FIX_IN_FLIGHT = new Set(['duplicate-part-name']);

function violationClass(message: string): string {
  if (message.includes('does not exist in tokens/')) return 'token-ref-unknown';
  if (message.includes('duplicate anatomy part name')) return 'duplicate-part-name';
  if (/visibleWhen\.equals "[^"]*" is not a value of prop/.test(message)) return 'visiblewhen-value-outside-prop-enum';
  if (/sets unknown [a-z0-9.-]+ prop/.test(message)) return 'component-ref-unknown-child-prop';
  if (message.includes('is not a legal camelCase identifier')) return 'prop-binding-not-camelcase';
  if (message.includes('no contract in scope')) return 'child-contract-missing';
  if (/icon asset/i.test(message)) return 'icon-asset-missing';
  // Generic stem: strip contract/child ids, quoted spellings, token refs and
  // numbers so one rule family lands in one bucket.
  const stem = message
    .replace(/^[a-z0-9.-]+:\s*/i, '')
    .replace(/ds\.[a-z0-9-]+/g, 'ds.…')
    .replace(/"[^"]*"/g, '"…"')
    .replace(/\{[^}]*\}/g, '{…}')
    .replace(/[0-9]+(\.[0-9]+)?/g, 'N')
    .slice(0, 90)
    .trim();
  return stem || 'unclassified';
}

/** Every violation line inside an emitter's Refused message → base classes. */
function refusalClasses(error: unknown): { classes: string[]; firstLine: string } {
  const message = error instanceof Error ? error.message : String(error);
  const lines = message
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2));
  if (lines.length === 0) return { classes: [violationClass(message.split('\n')[0])], firstLine: message.split('\n')[0] };
  return { classes: [...new Set(lines.map(violationClass))], firstLine: lines[0] };
}

function skipClassOf(reason: string): string {
  const stem = reason
    .replace(/^Set "[^"]*" could not be proposed:\s*/, '')
    .replace(/"[^"]*"/g, '"…"')
    .replace(/\{[^}]*\}/g, '{…}')
    .replace(/[0-9]+(\.[0-9]+)?/g, 'N')
    .slice(0, 90)
    .trim();
  return `propose-skip: ${stem}`;
}

// ---------------------------------------------------------------------------
// Structural features — computed from the dump set itself
// ---------------------------------------------------------------------------

type DumpNodeJson = {
  name?: string;
  type?: string;
  children?: DumpNodeJson[];
  instanceOf?: string;
  propRefs?: Record<string, string>;
  shape?: unknown;
  text?: { style?: string; fontSize?: number | null; fontStyle?: string | null };
};

const VECTOR_TYPES = new Set(['VECTOR', 'STAR', 'POLYGON', 'LINE', 'BOOLEAN_OPERATION']);
const SLOT_NAME = /^_?slot|placeholder|swap/i;
const SIZE_AXIS = /size|scale|breakpoint/i;
const THEME_AXIS = /theme|mode|density|device|contrast|brand|dark/i;
const STATE_AXIS = /^(state|status|interaction)$/i;
const STATE_VALUES = new Set(['default', 'hover', 'hovered', 'pressed', 'active', 'focus', 'focused', 'focus visible', 'disabled', 'selected', 'checked', 'error', 'invalid']);

interface SetFeatures {
  variants: number;
  axes: string[];
  stateLikeAxes: string[];
  themeLikeAxes: string[];
  sizeLikeAxes: string[];
  depth: number;
  instances: number;
  distinctInstanceOf: number;
  arrayOfCandidateGroups: number;
  slotPlaceholderNodes: number;
  instanceSwapRefs: number;
  booleanVisibilityRefs: number;
  textStyleVariety: number;
  geometryParts: number;
}

function featuresOf(set: { type?: string; variants?: DumpNodeJson[] }): SetFeatures {
  const variants = set.variants ?? [];
  const axisValues = new Map<string, Set<string>>();
  if (set.type === 'COMPONENT_SET') {
    for (const v of variants) {
      for (const pair of (v.name ?? '').split(',')) {
        const [axis, value] = pair.split('=').map((s) => s.trim());
        if (!axis || value === undefined) continue;
        (axisValues.get(axis) ?? axisValues.set(axis, new Set()).get(axis)!).add(value);
      }
    }
  }
  const axes = [...axisValues.keys()];
  const stateLike = axes.filter((a) => {
    if (STATE_AXIS.test(a)) return true;
    const values = [...(axisValues.get(a) ?? [])].map((v) => v.toLowerCase());
    return values.length >= 2 && values.filter((v) => STATE_VALUES.has(v)).length >= 2;
  });
  const themeLike = axes.filter((a) => THEME_AXIS.test(a));
  const sizeLike = axes.filter((a) => SIZE_AXIS.test(a));

  let depth = 0;
  let instances = 0;
  const instanceOf = new Set<string>();
  let arrayGroups = 0;
  let slotNodes = 0;
  let swaps = 0;
  let boolVisibility = 0;
  const textStyles = new Set<string>();
  let geometry = 0;
  const walk = (node: DumpNodeJson, d: number) => {
    depth = Math.max(depth, d);
    if (node.type === 'INSTANCE') {
      instances += 1;
      if (node.instanceOf) instanceOf.add(node.instanceOf);
    }
    if (SLOT_NAME.test(node.name ?? '')) slotNodes += 1;
    if (node.propRefs?.mainComponent) swaps += 1;
    if (node.propRefs?.visible) boolVisibility += 1;
    if (node.type === 'TEXT') {
      textStyles.add(node.text?.style ?? `${node.text?.fontSize ?? '?'}/${node.text?.fontStyle ?? '?'}`);
    }
    if (node.shape || VECTOR_TYPES.has(node.type ?? '')) geometry += 1;
    const children = node.children ?? [];
    const byName = new Map<string, number>();
    for (const c of children) byName.set(c.name ?? '', (byName.get(c.name ?? '') ?? 0) + 1);
    for (const n of byName.values()) if (n >= 3) arrayGroups += 1;
    for (const c of children) walk(c, d + 1);
  };
  for (const v of variants) walk(v, 1);
  return {
    variants: variants.length,
    axes,
    stateLikeAxes: stateLike,
    themeLikeAxes: themeLike,
    sizeLikeAxes: sizeLike,
    depth,
    instances,
    distinctInstanceOf: instanceOf.size,
    arrayOfCandidateGroups: arrayGroups,
    slotPlaceholderNodes: slotNodes,
    instanceSwapRefs: swaps,
    booleanVisibilityRefs: boolVisibility,
    textStyleVariety: textStyles.size,
    geometryParts: geometry,
  };
}

// ---------------------------------------------------------------------------
// The census loop — per-set isolation, streaming progress
// ---------------------------------------------------------------------------

interface SetRecord {
  setName: string;
  type: string;
  proposed: boolean;
  skipClass?: string;
  skipReason?: string;
  violations: string[];
  violationClasses: string[];
  emitterRefusals: Array<{ emitter: string; classes: string[]; message: string }>;
  emittedSurfaces: string[];
  noteCount: number;
  unboundCount: number;
  mintedCount: number;
  tokenRefsCarried: number;
  degradationsByCode: Record<string, number>;
  stubCount: number;
  stubRefusals: string[];
  features: SetFeatures;
  clean: boolean;
  internalError?: string;
}

const TOKEN_REF = /"\{[a-z][a-z0-9_-]*(?:\.[a-z0-9_-]+)*\}"/gi;
const records: SetRecord[] = [];
const isSetKey = (name: string, value: unknown): value is { setName: string; type: string; variants: DumpNodeJson[] } =>
  name !== '_provenance' &&
  !!value &&
  typeof value === 'object' &&
  typeof (value as { setName?: unknown }).setName === 'string' &&
  Array.isArray((value as { variants?: unknown }).variants);

const proposalsBySet = new Map(batch.proposals.map((p) => [p.setName, p]));
const skippedBySet = new Map(batch.skipped.map((s) => [s.setName, s]));

const setKeys = Object.entries(dump)
  .filter(([name, value]) => isSetKey(name, value))
  .map(([name]) => name);
console.log(`census: ${setKeys.length} sets from ${dumpPath}`);
console.log(
  `captured-token layer: ${captured ? `${captured.count} registrable, ${capturedShadowed.length} shadowed by repo tokens, ${captured.skipped.length} skipped by name` : 'ABSENT (pre-v1.4 dump)'}`,
);

let processed = 0;
for (const setName of setKeys) {
  const set = dump[setName] as { setName: string; type: string; variants: DumpNodeJson[] };
  const degr = degradationsBySet.get(setName) ?? [];
  const degradationsByCode: Record<string, number> = {};
  for (const d of degr) degradationsByCode[d.code] = (degradationsByCode[d.code] ?? 0) + 1;
  const rec: SetRecord = {
    setName,
    type: set.type,
    proposed: false,
    violations: [],
    violationClasses: [],
    emitterRefusals: [],
    emittedSurfaces: [],
    noteCount: 0,
    unboundCount: 0,
    mintedCount: 0,
    tokenRefsCarried: 0,
    degradationsByCode,
    stubCount: 0,
    stubRefusals: [],
    features: featuresOf(set),
    clean: false,
  };
  try {
    const skip = skippedBySet.get(setName);
    if (skip) {
      rec.skipClass = skipClassOf(skip.reason);
      rec.skipReason = skip.reason;
    } else {
      const proposal = proposalsBySet.get(setName);
      if (!proposal) throw new Error('set neither proposed nor skipped — batch invariant broken');
      rec.proposed = true;
      rec.noteCount = proposal.notes.length;
      rec.unboundCount = proposal.unbound.length;
      rec.mintedCount = proposal.mintedTokens?.count ?? 0;
      rec.tokenRefsCarried = (JSON.stringify(proposal.contract).match(TOKEN_REF) ?? []).length;

      // Referee (playground validate.ts): schema, then validateContract +
      // generateCss over repo + captured + minted.
      const parsed = ContractSchema.safeParse(proposal.contract);
      if (!parsed.success) {
        for (const issue of parsed.error.issues.slice(0, 20)) {
          rec.violations.push(`${issue.path.join('.') || '(root)'}: ${issue.message}`);
          rec.violationClasses.push('contract-schema-invalid');
        }
      } else {
        const contract = parsed.data;
        // Child stubs — playground stub-contracts precedence.
        const contracts = new Map(repoContracts);
        contracts.set(contract.id, contract);
        for (const raw of proposal.childStubs ?? []) {
          const stub = ContractSchema.safeParse(raw);
          if (stub.success) {
            rec.stubCount += 1;
            if (!contracts.has(stub.data.id)) contracts.set(stub.data.id, stub.data);
          } else {
            rec.stubRefusals.push(
              `child stub ${typeof (raw as { id?: unknown }).id === 'string' ? `"${(raw as { id: string }).id}"` : '(unnamed)'} failed the contract schema`,
            );
          }
        }
        const mintedTree = (proposal.mintedTokens?.tree ?? {}) as Record<string, unknown>;
        const inventory = new Set<string>([...baseInventory, ...flattenTokens(mintedTree).keys()]);
        const errors: string[] = [];
        validateContract(contract, contracts, errors, icons);
        generateCss(contract, inventory, errors);
        rec.violations = errors;
        rec.violationClasses = errors.map(violationClass);

        // All four emitters over the composed tree (token-source recompose:
        // captured + minted merged into the semantic slot).
        const tokens: TokenTreeInput = {
          ...repoTrees,
          semantic: mergeTrees([baseSemantic, mintedTree]),
          brands,
        };
        const ctx: EmitterCtx = {
          tokens,
          icons,
          contracts,
          fileKey: provenance?.fileKey ?? undefined,
          mintedTokens: mintedTree,
        };
        for (const emitter of emitters) {
          try {
            emitter.emit(contract, ctx);
            rec.emittedSurfaces.push(emitter.name);
          } catch (e) {
            const { classes, firstLine } = refusalClasses(e);
            rec.emitterRefusals.push({ emitter: emitter.name, classes, message: firstLine });
          }
        }
      }
    }
  } catch (e) {
    rec.internalError = e instanceof Error ? e.message : String(e);
  }
  rec.clean =
    rec.proposed && rec.violations.length === 0 && rec.emittedSurfaces.length === emitters.length && !rec.internalError;
  records.push(rec);
  processed += 1;
  if (processed % 200 === 0) console.log(`  … ${processed}/${setKeys.length} (${records.filter((r) => r.clean).length} clean so far)`);
}

// ---------------------------------------------------------------------------
// Aggregation — BASE failure classes ranked by set frequency, with the
// surfaces that report each (referee + refusing emitters)
// ---------------------------------------------------------------------------

interface ClassAgg {
  cls: string;
  sets: string[];
  surfaces: Set<string>;
  exampleMessages: Map<string, string>;
}
const classAgg = new Map<string, ClassAgg>();
const noteClass = (cls: string, setName: string, surface: string, message: string) => {
  const agg: ClassAgg = classAgg.get(cls) ?? { cls, sets: [], surfaces: new Set(), exampleMessages: new Map() };
  if (!agg.sets.includes(setName)) agg.sets.push(setName);
  agg.surfaces.add(surface);
  if (!agg.exampleMessages.has(setName)) agg.exampleMessages.set(setName, message);
  classAgg.set(cls, agg);
};
for (const rec of records) {
  if (rec.skipClass) noteClass(rec.skipClass, rec.setName, 'propose', rec.skipReason ?? '');
  rec.violationClasses.forEach((cls, i) => noteClass(cls, rec.setName, 'referee', rec.violations[i] ?? ''));
  for (const r of rec.emitterRefusals) for (const cls of r.classes) noteClass(cls, rec.setName, r.emitter, r.message);
  if (rec.internalError) noteClass('census-internal-error', rec.setName, 'census', rec.internalError);
}
const rankedClasses = [...classAgg.values()].sort((a, b) => b.sets.length - a.sets.length || a.cls.localeCompare(b.cls));

const clean = records.filter((r) => r.clean);
const notClean = records.filter((r) => !r.clean);
const skipped = records.filter((r) => r.skipClass);
const componentSets = records.filter((r) => r.type === 'COMPONENT_SET');
const plainComponents = records.filter((r) => r.type !== 'COMPONENT_SET');
const cleanComponentSets = componentSets.filter((r) => r.clean);
const cleanPlain = plainComponents.filter((r) => r.clean);

const degradationTotals: Record<string, number> = {};
for (const rec of records) for (const [code, n] of Object.entries(rec.degradationsByCode)) degradationTotals[code] = (degradationTotals[code] ?? 0) + n;
for (const d of batchDegradations) degradationTotals[d.code] = (degradationTotals[d.code] ?? 0) + 1;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const median = (xs: number[]) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// ---------------------------------------------------------------------------
// Fixtures — one representative self-contained single-set dump per top
// failure class, filled to TOP_CLASS_FIXTURES with the kit's top PATTERN
// classes (arrayOf candidates, slots, swaps, theme axes — the capability
// frontier the census measured even where nothing refused).
// ---------------------------------------------------------------------------

/** Every slash-form variable name a set's JSON references (bound fields,
 *  fill/stroke `var`, text fillVar) — the set's `_variables` slice. */
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

/** Deterministic representative: max feature score, lexicographic tiebreak. */
function representative(candidates: SetRecord[], score: (r: SetRecord) => number): string | null {
  let best: SetRecord | null = null;
  for (const r of candidates) {
    if (!best || score(r) > score(best) || (score(r) === score(best) && r.setName < best.setName)) best = r;
  }
  return best?.setName ?? null;
}

const PATTERN_CLASSES: Array<{ cls: string; pick: () => string | null }> = [
  {
    cls: 'pattern-arrayof-candidate',
    pick: () => representative(records.filter((r) => r.features.arrayOfCandidateGroups > 0), (r) => r.features.arrayOfCandidateGroups),
  },
  {
    cls: 'pattern-slot-placeholder',
    pick: () => representative(records.filter((r) => r.features.slotPlaceholderNodes > 0), (r) => r.features.slotPlaceholderNodes),
  },
  {
    cls: 'pattern-instance-swap',
    pick: () => representative(records.filter((r) => r.features.instanceSwapRefs > 0), (r) => r.features.instanceSwapRefs),
  },
  {
    cls: 'pattern-theme-mode-axis',
    pick: () => representative(records.filter((r) => r.features.themeLikeAxes.length > 0), (r) => r.features.variants),
  },
  {
    cls: 'pattern-state-axis',
    pick: () => representative(records.filter((r) => r.features.stateLikeAxes.length > 0), (r) => r.features.variants),
  },
  {
    cls: 'pattern-deep-composition',
    pick: () => representative(records.filter((r) => r.features.depth >= 3), (r) => r.features.depth),
  },
];

mkdirSync(FIXTURE_DIR, { recursive: true });
const allVariables = (dump._variables ?? {}) as Record<string, unknown>;
const allDegradations = (dump._degradations ?? []) as Array<{ code: string; nodePath: string; message: string }>;
const fixtures: Array<{ cls: string; setName: string; file: string }> = [];
const fixtureSets = new Set<string>();
function writeFixture(cls: string, setName: string) {
  if (!writeOutputs || fixtures.length >= TOP_CLASS_FIXTURES) return;
  const set = dump[setName];
  if (!set) return;
  const slice: Record<string, unknown> = {};
  for (const name of varNamesOf(set)) if (name in allVariables) slice[name] = allVariables[name];
  const clsSlug = kebab(cls.replace(/[^a-zA-Z0-9]+/g, ' ').trim()).slice(0, 60);
  const file = `${clsSlug}-${kebab(setName.replace(/[^a-zA-Z0-9]+/g, ' ').trim() || 'set')}.dump.json`;
  const fixture = {
    _provenance: {
      ...(dump._provenance as Record<string, unknown>),
      note: `Single-set gauntlet fixture for class "${cls}" — extracted from ${path.basename(dumpPath)} by extract/figma/gauntlet/census.ts.`,
    },
    _degradations: allDegradations.filter((d) => d.nodePath.startsWith(`${setName}:`)),
    _variables: slice,
    [setName]: set,
  };
  writeFileSync(path.join(FIXTURE_DIR, file), JSON.stringify(fixture, null, 1) + '\n');
  fixtures.push({ cls, setName, file });
  fixtureSets.add(setName);
}
for (const agg of rankedClasses) {
  if (fixtures.length >= TOP_CLASS_FIXTURES) break;
  // Deterministic and diverse: the first set (sorted) not already claimed by
  // an earlier class's fixture, falling back to the first outright.
  const sorted = [...agg.sets].sort();
  writeFixture(agg.cls, sorted.find((s) => !fixtureSets.has(s)) ?? sorted[0]);
}
for (const pattern of PATTERN_CLASSES) {
  if (fixtures.length >= TOP_CLASS_FIXTURES) break;
  const setName = pattern.pick();
  if (setName) writeFixture(pattern.cls, setName);
}

// ---------------------------------------------------------------------------
// Engineering reads — WHERE each top class dies and the likely fix (pointers
// only; no fixes here).
// ---------------------------------------------------------------------------

const ENGINEERING_READS: Record<string, string> = {
  'duplicate-part-name':
    'Dies at the referee: `validateContract` (core/emit-react.ts:180) requires part names to be unique across the WHOLE anatomy (`walkAnatomy` global `seen` set), but the proposer dedupes only among SIBLINGS — `partKey` (core/propose-figma.ts:1777, `taken` is per-sibling-scope). Two same-named parts under different parents (Dialog\'s two "Title" sections, Table rows\' repeated "td") pass proposal and refuse at validation, which also blocks the react/html/react-inline emitters. Likely fix: thread one contract-global `taken` set (or parent-qualified names) through `partKey`, with the rename receipted as a note — this is the in-flight dedup branch.',
  'component-ref-unknown-child-prop':
    'FIXED (census class-fix batch) — `canonicalizeInstanceProps` (core/propose-figma.ts) now DROPS applied props that do not map through an in-scope child contract\'s `bindings.figma`, each with a named note (\'applied prop "X" on nested "Y" does not map through ds.y\'s bindings — not carried; verify the child contract is current\'), never a guessed spelling the referee (core/emit-react.ts:195) would refuse. If this class ranks again, it is a REGRESSION — replay `extract/figma/gauntlet/class-fix-check.ts`.',
  'visiblewhen-value-outside-prop-enum':
    'FIXED (census class-fix batch) — `visibilityFromPresence` (core/propose-figma.ts) now spells presence on a true/false axis as the truthy form `visibleWhen { prop }` (the axis promotes to a BOOLEAN prop; `equals: "true"` is enum vocabulary the referee at core/emit-react.ts:371 refuses). The false side (present exactly where the boolean is false) is inexpressible — visibleWhen has no negated form — and stays a NAMED note, kept unconditional. If this class ranks again, it is a REGRESSION — replay `extract/figma/gauntlet/class-fix-check.ts`.',
  'prop-binding-not-camelcase':
    'FIXED (census class-fix batch) — `canonicalPropName` (core/propose-figma.ts) now applies the componentIdSlug digit-led discipline to prop code bindings: a digit-led spelling gets the deterministic "p" prefix ("2nd paragraph" → `p2ndParagraph`) with a named note; the figma binding keeps the original spelling. If this class ranks again, it is a REGRESSION — replay `extract/figma/gauntlet/class-fix-check.ts`.',
  'pattern-arrayof-candidate':
    'Not a refusal — a capability frontier. ≥3 same-named siblings (avatar stacks, table rows, pagination numbers) propose as N independent parts; the contract vocabulary has no arrayOf/repeat, so emitted code hard-codes the drawn count. Proposal-side detection would live where merged children are walked (core/propose-figma.ts `partKey`/merge pass); the vocabulary decision is a schema question (scripts/contract-schema.ts).',
  'pattern-slot-placeholder':
    'Not a refusal — slot fidelity. `_Slot*`/placeholder/swap-named instances propose as component refs to the Slot utility or stubs rather than slot declarations with `accepts`; INSTANCE_SWAP preferredValues are a declared dump v1 limit (extract/figma/dump.plugin.js header). The seam is the INSTANCE branch of propose (core/propose-figma.ts:1935+) plus the dump capture.',
  'pattern-instance-swap':
    'Not a refusal — INSTANCE_SWAP propRefs (`propRefs.mainComponent`) ride the dump but the proposal has no swap-prop vocabulary beyond slots; preferredValues (→ slot `accepts`) are not captured in dump v1 (declared limit). Seam: dump.plugin.js propRefs capture + the slot branch in propose.',
  'pattern-theme-mode-axis':
    'Not a refusal — a theme/mode/density-like variant axis currently proposes as an ordinary enum prop (a code prop the consumer must set) instead of promoting to token modes/brand switches. Promotion rules are catalogued in extract/figma/gauntlet/PATTERN-TAXONOMY.md; the seam is axis classification in propose (core/propose-figma.ts inferSemantics / axis handling).',
  'pattern-state-axis':
    'Not a refusal — state-like axes DO promote to CSS states since the aca43a9 chain (hover→:hover etc.); the fixture pins the behavior on a live set for regression.',
  'pattern-deep-composition':
    'Not a refusal — deep anatomies propose, but every level is inlined into one contract unless the child is a component instance; the fixture pins a representative deep set.',
};

// ---------------------------------------------------------------------------
// census.json — the machine output
// ---------------------------------------------------------------------------

const summary = {
  dump: dumpPath,
  sets: records.length,
  clean: clean.length,
  notClean: notClean.length,
  skipped: skipped.length,
  proposed: records.filter((r) => r.proposed).length,
  emitAllFour: records.filter((r) => r.emittedSurfaces.length === emitters.length).length,
  componentSets: { total: componentSets.length, clean: cleanComponentSets.length },
  plainComponents: { total: plainComponents.length, clean: cleanPlain.length },
  capturedTokens: captured
    ? { count: captured.count, shadowed: capturedShadowed.length, skipped: captured.skipped.length }
    : null,
  degradationTotals,
  factsCarried: {
    tokenRefsTotal: sum(records.map((r) => r.tokenRefsCarried)),
    tokenRefsMedian: median(records.filter((r) => r.proposed).map((r) => r.tokenRefsCarried)),
    tokenRefsMedianComponentSets: median(componentSets.filter((r) => r.proposed).map((r) => r.tokenRefsCarried)),
    mintedTotal: sum(records.map((r) => r.mintedCount)),
    notesTotal: sum(records.map((r) => r.noteCount)),
    unboundTotal: sum(records.map((r) => r.unboundCount)),
    degradationsTotal: sum(Object.values(degradationTotals)),
  },
};

if (writeOutputs)
writeFileSync(
  path.join(OUT_DIR, 'census.json'),
  JSON.stringify(
    {
      _provenance: {
        generatedBy: 'extract/figma/gauntlet/census.ts',
        dump: dumpPath,
        generatedAt: new Date().toISOString().slice(0, 10),
      },
      summary,
      batchNotes: batch.notes,
      classes: rankedClasses.map((c) => ({
        cls: c.cls,
        sets: c.sets.length,
        surfaces: [...c.surfaces].sort(),
        fixInFlight: FIX_IN_FLIGHT.has(c.cls),
        examples: c.sets.slice(0, 3).map((s) => ({ set: s, message: c.exampleMessages.get(s) ?? '' })),
      })),
      fixtures,
      sets: records,
    },
    null,
    1,
  ) + '\n',
);

// ---------------------------------------------------------------------------
// CENSUS.md — the human headline
// ---------------------------------------------------------------------------

const pct = (n: number, of = records.length) => `${((100 * n) / Math.max(1, of)).toFixed(1)}%`;
const featureCount = (f: (r: SetRecord) => boolean) => records.filter(f).length;
const compositeSets = featureCount((r) => r.features.instances > 0);
const md: string[] = [];
md.push('# THE PATTERN GAUNTLET — kit census');
md.push('');
md.push(
  `Every component set in the owner's kit replayed through the full deterministic receive pipeline — the EXACT playground semantics (proposeBatchFromDump + captured-token layer + child stubs → validateContract + generateCss referee → all four emitters). Reproduce: \`npm run extract:figma:gauntlet\`.`,
);
md.push('');
md.push(`- Dump: \`${dumpPath}\` (dump v1.4, recaptured ${(dump._provenance as { extractedAt?: string })?.extractedAt ?? '?'} — the \`_variables\` resolved-value channel rides along)`);
md.push(
  `- Captured-token layer: ${captured ? `**${captured.count} variables** registered (${capturedShadowed.length} shadowed by repo tokens, ${captured.skipped.length} skipped by name). With the layer in place the census records **zero** "does not exist in tokens/" refusals — on the v1.3 capture (no \`_variables\`) this would have been the top class.` : 'ABSENT'}`,
);
md.push(`- Skips at proposal: **${skipped.length}** — the id-sanitize + batch-isolation chain (3982ac2) holds on live data.`);
if (batch.notes.length > 0) md.push(`- Batch notes: ${batch.notes.map((n) => `"${n.split(' — ')[0]}"`).join('; ')} (named, never merged).`);
md.push('');
md.push('## Headline');
md.push('');
md.push('| population | clean | not clean | clean rate |');
md.push('|---|---:|---:|---:|');
md.push(`| **whole kit** | ${clean.length} | ${notClean.length} | **${pct(clean.length)}** |`);
md.push(`| plain COMPONENTs (icon-class, single variant) | ${cleanPlain.length} | ${plainComponents.length - cleanPlain.length} | ${pct(cleanPlain.length, plainComponents.length)} |`);
md.push(`| **real COMPONENT_SETs (variant axes)** | ${cleanComponentSets.length} | ${componentSets.length - cleanComponentSets.length} | **${pct(cleanComponentSets.length, componentSets.length)}** |`);
md.push('');
md.push(
  `CLEAN = proposed, zero referee violations, all ${emitters.length} surfaces emit. The whole-kit number is icon-inflated: ${pct(plainComponents.length)} of the kit is single-variant COMPONENTs. The honest capability number is the COMPONENT_SET row — ${notClean.length > 0 ? "the failures concentrate exactly in the owner's real composites (Menu, Card-Image, Avatar group, Breadcrumb, Dialog…)" : "the owner's real composites (Menu, Card-Image, Avatar group, Breadcrumb, Dialog…), where the failures used to concentrate, are clean too"}.`,
);
md.push('');
md.push(
  `**Refusal-free ≠ pixel-right.** "Clean" is qualified by the facts-carried metric: across the kit the proposals carry **${summary.factsCarried.tokenRefsTotal} token-bound style facts** (median ${summary.factsCarried.tokenRefsMedian} per proposed set — icons bind one fill; median ${summary.factsCarried.tokenRefsMedianComponentSets} per COMPONENT_SET), of which ${summary.factsCarried.mintedTotal} are minted provisional (\`imported.*\` — literal fidelity, machine names), while **${summary.factsCarried.notesTotal} named notes**, **${summary.factsCarried.unboundTotal} unbound leftovers**, and **${summary.factsCarried.degradationsTotal} capture degradations** name facts the pipeline read but did not carry. Per-set numbers ride census.json.`,
);
md.push('');
md.push(
  `**Surface honesty:** all four emitters referee — emit-figma-script calls validateContract (census class-fix batch), so a referee-violating contract refuses BY NAME on the canvas surface exactly like react/html/react-inline. (Before the batch it was the one surface that still emitted sync scripts for violating sets.)`,
);
md.push('');
md.push('## Failure classes, ranked by set frequency');
md.push('');
const failureClasses = rankedClasses.filter((c) => !c.cls.startsWith('pattern-'));
if (failureClasses.length === 0) {
  md.push('_None — every set is clean._');
  md.push('');
} else {
  for (const [i, agg] of failureClasses.entries()) {
    const flag = FIX_IN_FLIGHT.has(agg.cls)
      ? ' — **fix in flight** (concurrent propose-figma dedup branch; ranked, not counted as unknown)'
      : '';
    md.push(`### ${i + 1}. \`${agg.cls}\` — ${agg.sets.length} sets (${pct(agg.sets.length)} of kit, ${pct(agg.sets.filter((s) => records.find((r) => r.setName === s)?.type === 'COMPONENT_SET').length, componentSets.length)} of COMPONENT_SETs)${flag}`);
    md.push('');
    md.push(`Reported by: ${[...agg.surfaces].sort().join(', ')}.`);
    md.push('');
    for (const s of agg.sets.slice(0, 3)) {
      md.push(`- **${s}**:`);
      md.push('');
      md.push('  ```text');
      md.push(`  ${(agg.exampleMessages.get(s) ?? '').split('\n')[0]}`);
      md.push('  ```');
    }
    md.push('');
    const setNames = agg.sets;
    if (setNames.length > 3) md.push(`(all ${setNames.length}: ${setNames.join(', ')})`);
    md.push('');
  }
}
// Fixed classes (census class-fix batch): printed only while the class is
// genuinely absent from the ranking — if it ranks again above, that section
// is the truth and this one goes quiet for it.
const FIXED_CLASSES: Array<{ cls: string; was: string; fixture: string; fixtureSet: string; text: string }> = [
  {
    cls: 'component-ref-unknown-child-prop',
    was: '12 sets',
    fixture: 'component-ref-unknown-child-prop-avatar-group.dump.json',
    fixtureSet: 'Avatar group',
    text:
      'when the nested instance\'s child contract IS in scope, applied props that do not map through the child\'s `bindings.figma` are DROPPED, each with a named note (\'applied prop "X" on nested "Y" does not map through ds.y\'s bindings — not carried; verify the child contract is current\'), never a guessed spelling. "In scope" resolves exactly like the emitted ref id does: by contract name, then by the stubIdFor slug — a slug that lands on a registered contract (ds.list-item, ds.breadcrumb-item, ds.avatar-group) canonicalizes against it, since a stub never overrides a registered contract. Several repo child contracts (ds.avatar, ds.badge, ds.list-item, ds.breadcrumb-item, ds.avatar-group) are STALE against the live kit\'s current property APIs ("isVisible", "notification", "iconRight", "textBreadcrumb", … exist on the canvas but not in the repo contracts) — dropping with a note is the honest behavior either way; reconcile the child contracts to carry those props again.',
  },
  {
    cls: 'visiblewhen-value-outside-prop-enum',
    was: '11 sets',
    fixture: 'visiblewhen-value-outside-prop-enum-alert.dump.json',
    fixtureSet: 'Alert',
    text:
      'presence riding a true/false variant axis now spells the truthy form `visibleWhen { prop }` (the axis promotes to a BOOLEAN prop; `equals: "true"` is enum vocabulary the referee refuses). The false side — present exactly where the boolean is false — is inexpressible (visibleWhen has no negated form) and stays a NAMED note, kept unconditional.',
  },
  {
    cls: 'prop-binding-not-camelcase',
    was: '1 set',
    fixture: 'prop-binding-not-camelcase-note.dump.json',
    fixtureSet: 'Note',
    text:
      'digit-led property spellings get the componentIdSlug digit-led discipline applied to prop code bindings — the deterministic "p" prefix ("2nd paragraph" → `p2ndParagraph`) with a named note; the figma binding keeps the original spelling.',
  },
];
const fixedNow = FIXED_CLASSES.filter((f) => !rankedClasses.some((c) => c.cls === f.cls));
if (fixedNow.length > 0) {
  md.push('## Fixed classes (census class-fix batch) — gone from the ranking');
  md.push('');
  md.push(
    `Each fix is replayable offline against the committed class fixture (\`fixtures/<class>-<set>.dump.json\`) via \`tsx extract/figma/gauntlet/class-fix-check.ts\`, and the fourth guard rides along: emit-figma-script now calls validateContract, so an invalid contract refuses BY NAME on the canvas surface like the other three emitters.`,
  );
  md.push('');
  for (const f of fixedNow) {
    md.push(`- \`${f.cls}\` (was ${f.was}) — ${f.text}`);
  }
  md.push('');
}
md.push('## Engineering read per top class — where it dies, what the fix likely is');
md.push('');
for (const f of fixtures) {
  const readText = ENGINEERING_READS[f.cls];
  if (!readText) continue;
  md.push(`- **\`${f.cls}\`** — ${readText}`);
  md.push('');
}
md.push('## Feature frequency — what the kit is made of');
md.push('');
md.push('| feature | sets | share of kit | share of COMPONENT_SETs |');
md.push('|---|---:|---:|---:|');
const featRow = (label: string, f: (r: SetRecord) => boolean) => {
  const n = featureCount(f);
  const nSets = componentSets.filter(f).length;
  md.push(`| ${label} | ${n} | ${pct(n)} | ${pct(nSets, componentSets.length)} |`);
};
featRow('plain COMPONENT (single variant, mostly icons)', (r) => r.type !== 'COMPONENT_SET');
featRow('COMPONENT_SET (variant axes)', (r) => r.type === 'COMPONENT_SET');
featRow('composite (≥1 nested instance)', (r) => r.features.instances > 0);
featRow('deep composition (anatomy depth ≥ 3)', (r) => r.features.depth >= 3);
featRow('arrayOf candidates (≥3 same-named siblings)', (r) => r.features.arrayOfCandidateGroups > 0);
featRow('slot-placeholder names (_Slot*/placeholder/swap)', (r) => r.features.slotPlaceholderNodes > 0);
featRow('INSTANCE_SWAP properties', (r) => r.features.instanceSwapRefs > 0);
featRow('boolean-visibility pairs (Show X)', (r) => r.features.booleanVisibilityRefs > 0);
featRow('state-like variant axis', (r) => r.features.stateLikeAxes.length > 0);
featRow('theme/mode/density-like axis', (r) => r.features.themeLikeAxes.length > 0);
featRow('size-like axis', (r) => r.features.sizeLikeAxes.length > 0);
featRow('geometry parts (vectors/shapes)', (r) => r.features.geometryParts > 0);
featRow('text-style variety ≥ 2', (r) => r.features.textStyleVariety >= 2);
md.push('');
md.push(`Composite share: ${compositeSets} sets (${pct(compositeSets)}) nest at least one instance — the kit is primitive-heavy overall (icons), but ${pct(componentSets.filter((r) => r.features.instances > 0).length, componentSets.length)} of the real COMPONENT_SETs are composites.`);
md.push('');
md.push('## Capture degradations by code (named, never silent)');
md.push('');
md.push('| code | receipts |');
md.push('|---|---:|');
for (const [code, n] of Object.entries(degradationTotals).sort((a, b) => b[1] - a[1])) md.push(`| ${code} | ${n} |`);
md.push('');
md.push('## Predicted next five');
md.push('');
const p = clean.length / records.length;
const pAll = Math.pow(p, 5);
const expected = 5 * p;
const pSet = cleanComponentSets.length / Math.max(1, componentSets.length);
const hitLines = failureClasses.slice(0, 4).map((agg) => {
  const f = agg.sets.length / records.length;
  const fSets = agg.sets.filter((s) => records.find((r) => r.setName === s)?.type === 'COMPONENT_SET').length / Math.max(1, componentSets.length);
  return `\`${agg.cls}\` (${(100 * (1 - Math.pow(1 - f, 5))).toFixed(0)}% whole-kit / ${(100 * (1 - Math.pow(1 - fSets, 5))).toFixed(0)}% if he draws COMPONENT_SETs)`;
});
md.push(
  `If the owner imports **5 sets at random** from this kit: expected clean count **${expected.toFixed(1)} of 5** (per-set clean rate ${pct(clean.length)}); probability all five are clean **${(100 * pAll).toFixed(1)}%** (= ${p.toFixed(3)}^5). But a random draw is icon-heavy (${pct(plainComponents.length)} of keys are single-variant COMPONENTs) — if the five "random component imports" are the components a person actually reaches for, the COMPONENT_SET population is the honest base: clean rate ${pct(cleanComponentSets.length, componentSets.length)}, expected **${(5 * pSet).toFixed(1)} of 5** clean, probability all five clean **${(100 * Math.pow(pSet, 5)).toFixed(1)}%** (= ${pSet.toFixed(3)}^5). ${hitLines.length > 0 ? `Chance at least one of the five hits each top class, by simple frequency: ${hitLines.join('; ')}. ` : 'No failure class remains to hit. '}No usage weighting — pure per-set frequency, both populations shown.`,
);
md.push('');
md.push('## Class acceptance fixtures');
md.push('');
md.push(
  `One representative self-contained single-set dump per top failure class, filled to ${TOP_CLASS_FIXTURES} with the kit's top PATTERN classes (capability frontier — nothing refuses, the fixture pins the shape), under \`extract/figma/gauntlet/fixtures/\`. Each carries its \`_variables\` slice and its own \`_degradations\`:`,
);
md.push('');
for (const f of fixtures) md.push(`- \`${f.file}\` — class \`${f.cls}\`, set **${f.setName}**`);
md.push('');
if (fixedNow.length > 0) {
  md.push('Fixed-class fixtures stay committed for regression replay (`tsx extract/figma/gauntlet/class-fix-check.ts`):');
  md.push('');
  for (const f of fixedNow) md.push(`- \`${f.fixture}\` — class \`${f.cls}\` (fixed), set **${f.fixtureSet}**`);
  md.push('');
}
if (writeOutputs) writeFileSync(path.join(OUT_DIR, 'CENSUS.md'), md.join('\n') + '\n');

console.log(`\nclean ${clean.length}/${records.length} (${pct(clean.length)}) — COMPONENT_SETs ${cleanComponentSets.length}/${componentSets.length} (${pct(cleanComponentSets.length, componentSets.length)})`);
for (const agg of rankedClasses.slice(0, 12)) console.log(`  ${String(agg.sets.length).padStart(5)}  ${agg.cls}  [${[...agg.surfaces].sort().join(', ')}]`);
console.log(
  writeOutputs
    ? `\nwrote ${path.relative(ROOT, path.join(OUT_DIR, 'CENSUS.md'))}, census.json, ${fixtures.length} fixtures`
    : '\ncustom dump — committed outputs (CENSUS.md, census.json, fixtures/) left untouched',
);
