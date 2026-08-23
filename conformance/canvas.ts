/**
 * CSS/DOM CONFORMANCE FIXTURE — THE CANVAS HALF (the round trip).
 *
 *   npx tsx conformance/canvas.ts                 measure + compare against CANVAS-BASELINE.json
 *   npx tsx conformance/canvas.ts --write         re-record CANVAS-BASELINE.json + CANVAS-EXPECTATIONS.md (explicit act)
 *   npx tsx conformance/canvas.ts --report        rewrite CANVAS-EXPECTATIONS.md only
 *   npx tsx conformance/canvas.ts --case <id>     one case, verbose
 *
 * WHY THIS EXISTS. `npm run conformance` proves a construct reached the
 * CONTRACT. Its README names its own limit: the canvas column is DECLARED,
 * not measured, and there is no round trip. The v1 bar (docs/26) is
 * IDEMPOTENCE — contract → Figma → dump → propose ≡ contract, modulo walls
 * that are NAMED where a person reads them. This gate measures that bar on
 * the same manifest, the same denominator, the same channel per case.
 *
 * THE SEED. The contract this gate emits is the CAPTURED one — the
 * `enriched.contract.json` the CSS/DOM gate reads, the contract the construct
 * actually reached. `conformance/seeds/<id>.contract.json` is the EMPTY prop
 * space the capture enumerated against (anatomy.root is `{}` there); it is
 * required to exist, but it carries no construct and nothing to round-trip.
 *
 * THE CHAIN, one case at a time, every link the shipping code path:
 *
 *   1. bundle   the captured contract + its minted tree + the fixture DTCG
 *               form a CONTRACTS-BUNDLE; the plugin engine parses it and
 *               plans it EXACTLY as a paste (createPluginEngine →
 *               foreignEngineFor: the construction `figma bundle` uses);
 *               the code-only facts are compiled by the same engine
 *   2. canvas   every plan step is EXECUTED against the mock figma
 *               (scripts/plugin-engine-mock-figma.mjs) in a bare VM — the
 *               harness core/code-only-facts-check.ts uses
 *   3. dump     the ui.html #dump-source block (the bytes the plugin's
 *               Propose tab runs, drift-guarded against
 *               extract/figma/dump.plugin.js) reads the built set back
 *   4. propose  proposeBatchFromDump, exact projection, mintUnbound — the
 *               function the plugin's receive paths run
 *   5. diff     the proposal is read on the case's own channel by the same
 *               walk the CSS/DOM gate reads the captured contract with
 *               (carriageOfContract), refs resolved on both sides
 *
 * CLASSIFICATION — one per case, on the case's channel:
 *
 *   ROUND-TRIPPED     the proposal carries the channel with the seed's value
 *                     (refs resolved; `ref` records whether the SPELLING
 *                     survived too)
 *   NAMED             not carried, but the channel (or the case's lowering
 *                     receipt) is named in the NAMING UNION: the compiled
 *                     codeOnlyFacts, the set description, plan notes, the
 *                     mock step results, the dump's `_degradations`, the
 *                     proposal's notes / unbound entries, the batch's notes
 *                     and skips
 *   DRIFTED           the proposal carries the channel with a DIFFERENT
 *                     value and NOTHING names the lowering — a wrong answer,
 *                     worse than a named drop. RED. (A different value whose
 *                     lowering IS named — `display: block` lowered to a
 *                     vertical stack and back as `flex` — is NAMED, with the
 *                     returned value recorded.)
 *   HARMFUL           the manifest says the construct has NO canvas spelling
 *                     (`canvas.expect: ABSENT`) and the proposal carries it
 *                     anyway — the canvas drew what it must not. RED.
 *   SILENT            neither — the construct vanished and nothing says so.
 *                     RED, NEVER WAIVABLE: there is no receipt that turns a
 *                     SILENT green; it leaves the baseline only by being
 *                     fixed.
 *   REFUSED-BY-NAME   the canvas cannot host the seed and says so: the plan
 *                     refused, or the mock threw, or the emitted runtime
 *                     skipped the set with a reason. Fine — a named wall.
 *   SEED-ABSENT       the captured contract does not carry the construct in
 *                     the first place (the CSS/DOM gate's problem, not this
 *                     one's) — nothing to round-trip; counted, not red.
 *
 * THE RATCHET mirrors BASELINE.json: any change of classification is drift
 * in EITHER direction (a regression is red; an improvement must be recorded
 * with --write so a fix is never absorbed silently), a new or removed case is
 * drift, and the SILENT count may only DECREASE.
 *
 * NEUTRAL NAMING. The naming union is searched for the channel as a WORD
 * (`color` does not match `background-color`; `top` does not match
 * `top-left`), and the case's identity tokens (its export name, contract id,
 * the set name the canvas drew, the minted-path prefix that spells the case)
 * are removed first — the engine echoing a component's own name is not a
 * receipt. mintedTokens trees are NOT in the union: a channel name inside a
 * minted token PATH is carriage bookkeeping, not a receipt (the CSS/DOM gate's
 * rule).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {
  ContractSchema,
  createFigmaEngine,
  dumpCapturesHidden,
  proposeBatchFromDump,
  tokenCorpusFromJson,
  tokenSetTokenTrees,
  type CodeOnlyFact,
  type Contract,
  type TokenSetPayload,
} from '../core/index.js';
import { createPluginEngine } from '../figma-sync/plugin/engine/entry.js';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { mergeTokenTrees } from '../extract/figma/tokens.js';
import { exportNameFor, HERE, loadCases, outDirFor, REPO, type CaseEntry } from './build.js';
import { carriageOfContract, identityTokens, normValue, OUT_ROOT, valueAgrees, type CarriageHit } from './run.js';

export const CANVAS_BASELINE = path.join(HERE, 'CANVAS-BASELINE.json');
export const CANVAS_EXPECTATIONS = path.join(HERE, 'CANVAS-EXPECTATIONS.md');

export type Classification =
  | 'ROUND-TRIPPED'
  | 'NAMED'
  | 'DRIFTED'
  | 'HARMFUL'
  | 'SILENT'
  | 'REFUSED-BY-NAME'
  | 'SEED-ABSENT';

export const CLASSIFICATIONS: readonly Classification[] = [
  'ROUND-TRIPPED', 'NAMED', 'DRIFTED', 'HARMFUL', 'SILENT', 'REFUSED-BY-NAME', 'SEED-ABSENT',
];
export const RED_CLASSIFICATIONS: readonly Classification[] = ['SILENT', 'DRIFTED', 'HARMFUL'];

/** Better → worse. A move to a higher rank is a regression. */
const RANK: Record<Classification, number> = {
  'ROUND-TRIPPED': 0, 'SEED-ABSENT': 1, 'REFUSED-BY-NAME': 2, NAMED: 3, DRIFTED: 4, HARMFUL: 5, SILENT: 6,
};

export interface CanvasMeasured {
  id: string;
  feature: string;
  construct: string;
  expect: CaseEntry['expect'];
  channel: string;
  classification: Classification;
  /** The seed's carriage on the channel (resolved values), and its raw spelling. */
  seed: string[];
  seedRaw: string[];
  /** The proposal's carriage on the channel (resolved), and its raw spelling. */
  proposed: string[];
  proposedRaw: string[];
  /** ROUND-TRIPPED only: did the token REF spelling survive, not just the value? */
  refIdentical?: boolean;
  /** ROUND-TRIPPED only, when the proposal spells the construct on a SIBLING
   *  channel of the same shorthand family (`border-radius` for
   *  `border-top-left-radius`). Absent when the channel came back as itself. */
  channelAs?: string;
  /** The text that NAMED the loss (NAMED), the refusal (REFUSED-BY-NAME), or
   *  the nearest thing to an explanation the union holds (SILENT: empty). */
  note: string;
  /** How far the chain got. */
  reached: 'plan' | 'canvas' | 'dump' | 'propose' | 'diff';
  codeOnlyFacts: number;
}

// ---------------------------------------------------------------------------
// shared fixtures — read once
// ---------------------------------------------------------------------------
const readJson = <T>(p: string): T | null => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null);

/** The dump script EXACTLY as the plugin runs it: the ui.html #dump-source
 *  block (drift-guarded against extract/figma/dump.plugin.js by
 *  plugin-engine-check), with the TARGET_SETS seam scoped to one set the way
 *  the Propose tab scopes it. */
function dumpSourceFor(setName: string): string {
  const ui = readFileSync(path.join(REPO, 'figma-sync', 'plugin', 'ui.html'), 'utf8');
  const openTag = '<script type="text/plain" id="dump-source">';
  const start = ui.indexOf(openTag);
  if (start < 0) throw new Error('figma-sync/plugin/ui.html carries no #dump-source block');
  const source = ui.slice(start + openTag.length, ui.indexOf('</script>', start)).replace(/^\n/, '');
  const scoped = source.replace(/^const TARGET_SETS = \[[^\n]*\];$/m, `const TARGET_SETS = ${JSON.stringify([setName])};`);
  if (scoped === source) throw new Error('the dump script TARGET_SETS seam did not scope');
  return scoped;
}

/** Flat DTCG (the fixture's tokens are flat by convention) — the same
 *  flattener `figma bundle` applies, mirrored. */
const flattenDtcg = (node: Record<string, unknown>, prefix: string[] = [], out: Record<string, unknown> = {}): Record<string, unknown> => {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$')) continue;
    if (v && typeof v === 'object' && '$value' in (v as object)) out[[...prefix, k].join('.')] = v;
    else if (v && typeof v === 'object') flattenDtcg(v as Record<string, unknown>, [...prefix, k], out);
  }
  return out;
};

const silentConsole = { log() {}, warn() {}, error() {} };

/** SHORTHAND FAMILIES — the one equivalence this gate admits. The proposer
 *  spells a uniform four-corner radius as `border-radius`, the captured
 *  contract spells it per corner; both carry the same ref. That is a
 *  respelling, not a loss, and the gate records it (`channelAs`) instead of
 *  calling it SILENT. The table is MIRRORED here (never imported from the
 *  emitters) and deliberately small: only shorthands whose every longhand is
 *  the same value type. Anything outside it is compared on the exact channel. */
const SHORTHAND_OF: Record<string, string> = {
  'border-top-left-radius': 'border-radius', 'border-top-right-radius': 'border-radius',
  'border-bottom-right-radius': 'border-radius', 'border-bottom-left-radius': 'border-radius',
  'padding-top': 'padding', 'padding-right': 'padding', 'padding-bottom': 'padding', 'padding-left': 'padding',
  'row-gap': 'gap', 'column-gap': 'gap',
  top: 'inset', right: 'inset', bottom: 'inset', left: 'inset',
  'grid-row-start': 'grid-row', 'grid-row-end': 'grid-row',
  'grid-column-start': 'grid-column', 'grid-column-end': 'grid-column',
};
/** Logical twins — the proposer spells a symmetric left/right padding as
 *  `padding-inline` (same ref). Same rule, same smallness. */
const LOGICAL_OF: Record<string, string> = {
  'padding-left': 'padding-inline', 'padding-right': 'padding-inline',
  'padding-top': 'padding-block', 'padding-bottom': 'padding-block',
  left: 'inset-inline', right: 'inset-inline', top: 'inset-block', bottom: 'inset-block',
};
export const channelFamily = (ch: string): string[] => {
  const short = SHORTHAND_OF[ch] ?? ch;
  const longs = Object.entries(SHORTHAND_OF).filter(([, s]) => s === short).map(([l]) => l);
  const logical = LOGICAL_OF[ch];
  return [...new Set([ch, short, ...longs, ...(logical ? [logical] : [])])];
};

/** STRICT agreement for the round trip — normalised equality only. The
 *  CSS/DOM gate's containment test (`valueAgrees`) exists to match a browser
 *  serialization against a contract spelling; on a contract-to-contract
 *  comparison it launders `inline-flex` into `flex` and `Visible` into
 *  `INVISIBLE-SENTINEL`. */
const sameValue = (a: string, b: string): boolean => normValue(a) === normValue(b);

/** Word-boundary search: `color` must not be satisfied by `background-color`,
 *  `top` not by `top-left`. Channels are CSS words, so `-` is part of the word. */
const namesWord = (hay: string, word: string): boolean => {
  const w = word.replace(/^__/, '');
  const re = new RegExp(`(^|[^a-z0-9-])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9-])`, 'i');
  return re.test(hay);
};
/** The first union LINE that names the word — a receipt is one line. */
const quoteLine = (hay: string, word: string): string => {
  const line = hay.split('\n').find((l) => namesWord(l, word));
  return line ? line.replace(/\s+/g, ' ').trim().slice(0, 400) : '';
};

// ---------------------------------------------------------------------------
// the round trip
// ---------------------------------------------------------------------------
export async function roundTrip(c: CaseEntry, verbose = false): Promise<CanvasMeasured> {
  const ch = c.observable.channel;
  const outDir = path.join(OUT_ROOT, outDirFor(c.id));
  const seedPath = path.join(HERE, 'seeds', `${c.id}.contract.json`);
  if (!existsSync(seedPath)) throw new Error(`${c.id}: no seed at ${path.relative(REPO, seedPath)} — run npm run conformance:build`);
  const contract = readJson<Record<string, unknown>>(path.join(outDir, 'enriched.contract.json'));
  const ext = readJson<{ mintedTokens?: Record<string, unknown> }>(path.join(outDir, 'enriched.extension.json'));
  const dtcgNested = readJson<Record<string, unknown>>(path.join(HERE, 'tokens', 'conformance.dtcg.json')) ?? {};
  const minted = ext?.mintedTokens ?? {};
  const base: Omit<CanvasMeasured, 'classification' | 'note' | 'reached'> = {
    id: c.id, feature: c.feature, construct: c.construct, expect: c.expect, channel: ch,
    seed: [], seedRaw: [], proposed: [], proposedRaw: [], codeOnlyFacts: 0,
  };
  if (!contract) {
    return { ...base, classification: 'SEED-ABSENT', reached: 'plan', note: `no captured contract at ${path.relative(REPO, outDir)} — run npm run conformance:capture` };
  }

  // --- the seed's own carriage on the channel --------------------------------
  const target = c.observable.carriedValue ?? c.observable.capturedValue ?? '';
  const seedAll = carriageOfContract(contract, [minted, dtcgNested]).get(ch) ?? [];
  // Which seed hits ARE the construct: strict first; the CSS/DOM gate's looser
  // containment only when strict finds nothing (browser serialization vs
  // contract spelling — box-shadow layers, matrix() transforms).
  const strictHits = target === '' ? seedAll : seedAll.filter((h) => sameValue(h.value, target));
  const seedHits = strictHits.length > 0 || target === '' ? strictHits : seedAll.filter((h) => valueAgrees(h.value, target));
  base.seed = [...new Set(seedHits.map((h) => h.value))].sort();
  base.seedRaw = [...new Set(seedHits.map((h) => h.raw))].sort();
  if (seedHits.length === 0) {
    return { ...base, classification: 'SEED-ABSENT', reached: 'plan', note: `the captured contract does not carry "${ch}" = ${target || '(any)'} — the CSS/DOM gate's finding, nothing to round-trip` };
  }

  // --- 1. bundle + plan (the plugin's paste path) ----------------------------
  const tokenSet: TokenSetPayload = {
    name: 'Conformance',
    base: flattenDtcg(dtcgNested),
    ...(Object.keys(minted).length > 0 ? { minted } : {}),
  };
  const bundle = { type: 'CONTRACTS-BUNDLE', version: 1, tokenSet, contracts: [contract] };
  const plugin = createPluginEngine({
    tokens: { primitives: {}, semantic: {}, light: {}, dark: {}, brands: { default: {} } },
    contracts: [],
    icons: {},
  });
  const union: string[] = [];
  const parsed = plugin.parseIncomingText(JSON.stringify(bundle));
  if (!parsed.ok) return { ...base, classification: 'REFUSED-BY-NAME', reached: 'plan', note: `plugin parse: ${parsed.issue.headline}` };
  const plan = plugin.planGenerate(parsed.contracts, { withTokens: true, fileKey: '', tokenSet: parsed.tokenSet, icons: parsed.icons });
  if (!plan.ok) return { ...base, classification: 'REFUSED-BY-NAME', reached: 'plan', note: `plugin plan: ${plan.issues.map((i) => i.headline + (i.detail ? ` — ${i.detail}` : '')).join('; ')}` };
  union.push(...plan.notes);

  // The code-only facts, compiled by the SAME engine construction `figma
  // bundle` uses (createFigmaEngine over tokenSetTokenTrees(tokenSet)).
  const engine = createFigmaEngine({ tokens: tokenSetTokenTrees(tokenSet), icons: new Map() });
  const schemaContract = ContractSchema.parse(contract) as Contract;
  let facts: CodeOnlyFact[] = [];
  let description = '';
  try {
    const data = engine.compileComponentData(schemaContract, new Map([[schemaContract.id, schemaContract]]));
    facts = data.codeOnlyFacts ?? [];
    description = data.description;
  } catch (e) {
    return { ...base, classification: 'REFUSED-BY-NAME', reached: 'plan', note: `compile: ${e instanceof Error ? e.message : String(e)}` };
  }
  base.codeOnlyFacts = facts.length;
  for (const f of facts) union.push(`code-only ${f.kind} ${f.part}.${f.channel} = ${f.value} — ${f.reason}`);
  union.push(description);

  // --- 2. the canvas: execute every step against a FRESH mock ---------------
  const { figma, root } = createFigmaMock();
  const ctx = vm.createContext({ figma, console: silentConsole });
  const run = (code: string): Promise<unknown> => vm.runInContext(`(async () => {\n${code}\n})()`, ctx, { timeout: 300_000 }) as Promise<unknown>;
  let stepResult: Record<string, unknown> | null = null;
  for (const step of plan.steps) {
    try {
      const result = (await run(step.code)) as { results?: Array<Record<string, unknown>> } | undefined;
      if (step.kind === 'component') stepResult = result?.results?.[0] ?? null;
    } catch (e) {
      return { ...base, classification: 'REFUSED-BY-NAME', reached: 'canvas', note: `mock figma (${step.kind} step): ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  if (stepResult) {
    const { codeOnlyFacts: _facts, ...rest } = stepResult;
    union.push(`step result: ${JSON.stringify(rest)}`);
  }
  type MarkedNode = { name: string; type: string; getSharedPluginData: (ns: string, k: string) => string };
  const node = root.findOne(
    (n: MarkedNode) => (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') && n.getSharedPluginData('ds_contracts', 'contractId') === schemaContract.id,
  ) as MarkedNode | null;
  if (!node) {
    const reason = typeof stepResult?.reason === 'string' ? stepResult.reason : '';
    if (reason) return { ...base, classification: 'REFUSED-BY-NAME', reached: 'canvas', note: `runtime skipped the set: ${reason}` };
    return { ...base, classification: 'SILENT', reached: 'canvas', note: 'the set was not built and nothing named why' };
  }

  // --- 3. dump (the Propose tab's own script) -------------------------------
  let dump: Record<string, unknown>;
  try {
    dump = (await run(dumpSourceFor(node.name))) as Record<string, unknown>;
  } catch (e) {
    return { ...base, classification: 'REFUSED-BY-NAME', reached: 'dump', note: `dump script: ${e instanceof Error ? e.message : String(e)}` };
  }
  const set = dump?.[node.name];
  if (!set) return { ...base, classification: 'SILENT', reached: 'dump', note: `the dump captured no set named "${node.name}"` };
  for (const d of (dump._degradations ?? []) as Array<{ code: string; nodePath: string; message: string }>) {
    union.push(`degradation ${d.code} @ ${d.nodePath}: ${d.message}`);
  }

  // --- 4. propose (exact, minting) ------------------------------------------
  const corpus = tokenCorpusFromJson({
    primitives: {},
    semantic: mergeTokenTrees([dtcgNested, minted]),
    light: {},
    brandDefault: {},
  });
  const batch = proposeBatchFromDump(dump, {
    corpus,
    contractIdByName: new Map([[schemaContract.name, schemaContract.id]]),
    contractsById: new Map([[schemaContract.id, contract as never]]),
    contractIdByKey: new Map(),
    fileKey: null,
    projectionMode: 'exact',
    mintUnbound: true,
    hiddenCaptured: dumpCapturesHidden(dump._provenance as never),
  });
  for (const s of batch.skipped) union.push(`skip: ${s.reason}${s.detail ? ` — ${s.detail}` : ''}`);
  union.push(...batch.notes);
  const proposal = batch.proposals.find((p) => p.setName === node.name) ?? batch.proposals[0];
  if (proposal) {
    union.push(...proposal.notes);
    for (const u of proposal.unbound) {
      union.push(`unbound ${u.nodePath} ${u.property} = ${String(u.value)}${u.suggestions.length > 0 ? ` (nearest: ${u.suggestions.join(', ')})` : ''}`);
    }
  }

  // --- the union, with the case's identity removed --------------------------
  let unionText = union.join('\n');
  const identity = [
    ...identityTokens(c.id, exportNameFor(c.id)),
    node.name,
    `imported.case-${c.id}`,
    `imported/case-${c.id}`,
    `imported.${schemaContract.name.toLowerCase()}`,
  ];
  for (const t of identity) if (t) unionText = unionText.split(t).join('«self»');
  // A synthetic channel (`__text`) is not a word any receipt would use —
  // "text" appears in sentences about typography — so it never names itself;
  // only the seed's own part can (below).
  const namedByChannel = !ch.startsWith('__') && namesWord(unionText, ch);
  const namedByReceipt = c.expect === 'LOWERED' && !!c.expectName && namesWord(unionText, c.expectName);
  // `__text` is synthetic: the construct is "this PART's text". A receipt that
  // names the seed's own part as not drawn (`label-2.display = none`) is the
  // honest name for the text it carried — the part name is the SEED's, so
  // this admits nothing the contract did not itself spell.
  const textParts = ch === '__text' ? [...new Set(seedHits.map((h) => h.part))] : [];
  const namedByPart = textParts.find((part) => namesWord(unionText, part));
  const named = namedByChannel || namedByReceipt || namedByPart !== undefined;
  const namingQuote = quoteLine(unionText, namedByChannel ? ch : namedByReceipt ? c.expectName : (namedByPart ?? ch));
  if (verbose) {
    console.log(`\n--- ${c.id}: naming union (${union.length} lines) ---`);
    for (const l of union) console.log(`  · ${l.length > 300 ? l.slice(0, 300) + '…' : l}`);
  }

  if (!proposal) {
    const reached = 'propose';
    if (named) return { ...base, classification: 'NAMED', reached, note: namingQuote };
    return { ...base, classification: 'SILENT', reached, note: batch.skipped.map((s) => s.reason).join('; ') || 'no proposal and nothing named why' };
  }

  // --- 5. diff on the channel -----------------------------------------------
  const trees = [proposal.mintedTokens?.tree ?? {}, minted, dtcgNested];
  const pieces: Record<string, unknown>[] = [proposal.contract, ...((proposal.childStubs ?? []) as Record<string, unknown>[])];
  const proposedAll: Array<CarriageHit & { channel: string }> = pieces.flatMap((p) => {
    const carriage = carriageOfContract(p, trees);
    return channelFamily(ch).flatMap((fam) => (carriage.get(fam) ?? []).map((h) => ({ ...h, channel: fam })));
  });
  // For `__text` only a hit on the SAME part is a comparable value — a
  // sibling part's text is a different construct, not a drifted one.
  const comparable = ch === '__text' ? proposedAll.filter((h) => seedHits.some((s) => s.part === h.part)) : proposedAll;
  base.proposed = [...new Set(comparable.map((h) => h.value))].sort();
  base.proposedRaw = [...new Set(comparable.map((h) => h.raw))].sort();
  const agree = comparable.filter((h) => seedHits.some((s) => sameValue(h.value, s.value)));
  if (verbose) {
    console.log(`  dump set: ${JSON.stringify(set).slice(0, 1500)}`);
    console.log(`  proposal anatomy: ${JSON.stringify((proposal.contract as { anatomy?: unknown }).anatomy)}`);
    console.log(`  proposal minted: ${JSON.stringify(proposal.mintedTokens?.tree ?? {})}`);
    console.log(`  seed     ${ch}: ${seedHits.map((h) => `${h.part}.${h.where} = ${h.raw} → ${h.value}`).join(' | ')}`);
    console.log(`  proposed ${ch}: ${proposedAll.map((h) => `${h.part}.${h.where}[${h.channel}] = ${h.raw} → ${h.value}`).join(' | ') || '(absent)'}`);
  }
  if (agree.length > 0) {
    const refIdentical = agree.some((h) => seedHits.some((s) => s.raw === h.raw || (normValue(s.raw) === normValue(h.raw))));
    const exact = agree.find((h) => h.channel === ch);
    const channelAs = exact ? undefined : agree[0].channel;
    const notes = [
      ...(refIdentical ? [] : [`ref respelled: ${base.seedRaw.join(', ')} → ${base.proposedRaw.join(', ')}`]),
      ...(channelAs ? [`channel respelled: ${ch} → ${channelAs}`] : []),
    ];
    if (c.canvas.expect === 'ABSENT') {
      return { ...base, classification: 'HARMFUL', reached: 'diff', note: `the manifest says "${ch}" has no canvas spelling (${c.canvas.note}) — the proposal carries it anyway: ${base.proposed.join(', ')}` };
    }
    return { ...base, classification: 'ROUND-TRIPPED', reached: 'diff', refIdentical, ...(channelAs ? { channelAs } : {}), note: notes.join('; ') };
  }
  const differs = comparable.length > 0 ? `value came back as ${base.proposed.join(', ')} (seed ${base.seed.join(', ')})` : '';
  if (named) return { ...base, classification: 'NAMED', reached: 'diff', note: `${differs ? differs + ' — ' : ''}${namingQuote}` };
  if (comparable.length > 0) {
    return { ...base, classification: 'DRIFTED', reached: 'diff', note: `the proposal carries "${ch}" as ${base.proposed.join(', ')} — the seed says ${base.seed.join(', ')}; nothing names the lowering` };
  }
  return { ...base, classification: 'SILENT', reached: 'diff', note: '' };
}

export const roundTripCases = (): CaseEntry[] => loadCases().filter((c) => c.expect === 'CARRIED' || c.expect === 'LOWERED');

export async function measureAllCanvas(only?: string, verbose = false): Promise<CanvasMeasured[]> {
  const out: CanvasMeasured[] = [];
  for (const c of roundTripCases()) {
    if (only && c.id !== only) continue;
    out.push(await roundTrip(c, verbose));
  }
  return out;
}

// ---------------------------------------------------------------------------
// the ratchet
// ---------------------------------------------------------------------------
export interface CanvasBaselineFile {
  _marker: string;
  measuredAt: string;
  counts: Record<string, number>;
  cases: Record<string, { classification: Classification; channel: string; seed: string[]; proposed: string[]; refIdentical?: boolean; channelAs?: string; note: string }>;
}

export function summarizeCanvas(rows: CanvasMeasured[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const k of CLASSIFICATIONS) counts[k] = 0;
  for (const r of rows) counts[r.classification]++;
  return counts;
}

export function compareToCanvasBaseline(rows: CanvasMeasured[]): string[] {
  const baseline = readJson<CanvasBaselineFile>(CANVAS_BASELINE);
  if (!baseline) return ['no CANVAS-BASELINE.json — run `npx tsx conformance/canvas.ts --write` to record the first measured round trip'];
  const drift: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    seen.add(r.id);
    const was = baseline.cases[r.id]?.classification;
    if (was === undefined) { drift.push(`NEW CASE ${r.id}: ${r.classification} — the manifest grew; re-record the baseline deliberately`); continue; }
    if (was === r.classification) continue;
    if (RANK[r.classification] > RANK[was]) drift.push(`REGRESSION ${r.id}: ${was} → ${r.classification} on "${r.channel}" (${r.note || 'nothing named it'})`);
    else drift.push(`IMPROVED ${r.id}: ${was} → ${r.classification} — record it (a fixed defect must never be absorbed silently)`);
  }
  for (const id of Object.keys(baseline.cases)) if (!seen.has(id)) drift.push(`REMOVED ${id}: the baseline names a case the manifest no longer round-trips`);
  const silent = rows.filter((r) => r.classification === 'SILENT').length;
  if (silent > (baseline.counts.SILENT ?? 0)) {
    drift.push(`SILENT RATCHET: ${baseline.counts.SILENT ?? 0} → ${silent}. SILENT may only DECREASE — a construct that vanishes on the canvas with nothing naming it is never waivable.`);
  }
  return drift;
}

export function baselineFileOf(rows: CanvasMeasured[]): CanvasBaselineFile {
  return {
    _marker:
      'THE MEASURED ROUND TRIP — contract → Figma (mock) → dump → propose ≡ contract, per conformance case, on the case\'s own channel. Every SILENT entry is an OPEN DEFECT the engine must name or carry; it is never waivable and leaves this file only by being fixed. The gate refuses drift in EITHER direction: a regression is red, and an improvement must be re-recorded here so a fix can never be absorbed silently.',
    measuredAt: 'extract/computed/out/conformance/<case>/enriched.contract.json through figma-sync/plugin/engine (mock figma) and core/propose-figma (npx tsx conformance/canvas.ts)',
    counts: summarizeCanvas(rows),
    cases: Object.fromEntries(
      rows.map((r) => [r.id, {
        classification: r.classification, channel: r.channel, seed: r.seed, proposed: r.proposed,
        ...(r.refIdentical !== undefined ? { refIdentical: r.refIdentical } : {}), ...(r.channelAs ? { channelAs: r.channelAs } : {}), note: r.note,
      }]),
    ),
  };
}

// ---------------------------------------------------------------------------
// the report — CANVAS-EXPECTATIONS.md, deterministic from the measurement
// ---------------------------------------------------------------------------
const esc = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const MARK: Record<Classification, string> = {
  'ROUND-TRIPPED': '🟢', NAMED: '🟢', 'REFUSED-BY-NAME': '🟡', 'SEED-ABSENT': '⚪', DRIFTED: '🔴', HARMFUL: '🔴', SILENT: '🔴',
};

export function renderCanvasReport(rows: CanvasMeasured[]): string {
  const counts = summarizeCanvas(rows);
  const red = RED_CLASSIFICATIONS.reduce((n, k) => n + counts[k], 0);
  const L: string[] = [];
  L.push('# CSS/DOM conformance — CANVAS ROUND TRIP');
  L.push('');
  L.push('*GENERATED by `npx tsx conformance/canvas.ts --write` (or `--report`). Do not');
  L.push('edit — edit the case directories under `conformance/cases/` and re-run.*');
  L.push('');
  L.push('The canvas half of the capability matrix, MEASURED: for every case the CSS/DOM');
  L.push('gate declares CARRIED or LOWERED, the captured contract is emitted through the');
  L.push('plugin engine into the mock `figma`, dumped back by the plugin\'s own dump');
  L.push('script, proposed back by `proposeBatchFromDump` (exact, minting), and compared');
  L.push('to the captured contract on the case\'s own channel. The v1 bar is idempotence');
  L.push('modulo NAMED walls: a construct that vanishes with nothing naming it is red and');
  L.push('never waivable.');
  L.push('');
  L.push('## The numbers');
  L.push('');
  L.push('| | |');
  L.push('|---|---|');
  L.push(`| cases (CARRIED + LOWERED) | **${rows.length}** |`);
  L.push(`| 🟢 round-tripped | **${counts['ROUND-TRIPPED']}** |`);
  L.push(`| 🟢 named (dropped, and a receipt says so) | **${counts.NAMED}** |`);
  L.push(`| 🟡 refused by name (the canvas cannot host the seed, and says so) | **${counts['REFUSED-BY-NAME']}** |`);
  L.push(`| ⚪ seed-absent (nothing to round-trip) | **${counts['SEED-ABSENT']}** |`);
  L.push(`| 🔴 red | **${red}** — SILENT ${counts.SILENT} · DRIFTED ${counts.DRIFTED} · HARMFUL ${counts.HARMFUL} |`);
  L.push('');
  L.push('Verdicts: **ROUND-TRIPPED** the channel came back with the seed\'s value (refs');
  L.push('resolved; "ref" says whether the token spelling survived, "as" names a');
  L.push('shorthand/logical sibling the proposer used) · **NAMED** dropped, but the channel');
  L.push('is named in the union of code-only facts, set description, plan notes, mock');
  L.push('step results, dump `_degradations`, proposal notes/unbound, batch notes/skips ·');
  L.push('**REFUSED-BY-NAME** the plan, the mock, or the runtime refused the whole seed by');
  L.push('name · **DRIFTED** a different value came back and nothing named the lowering ·');
  L.push('**HARMFUL** the manifest says no canvas spelling exists and it came back anyway ·');
  L.push('**SILENT** vanished, named by nothing — never waivable.');
  L.push('');
  const order: Classification[] = ['SILENT', 'DRIFTED', 'HARMFUL', 'NAMED', 'REFUSED-BY-NAME', 'SEED-ABSENT', 'ROUND-TRIPPED'];
  for (const k of order) {
    const group = rows.filter((r) => r.classification === k);
    if (group.length === 0) continue;
    L.push(`## ${MARK[k]} ${k} — ${group.length}`);
    L.push('');
    L.push('| case | feature | construct | channel | expect | came back | ref | as | note |');
    L.push('|---|---|---|---|---|---|---|---|---|');
    for (const r of group) {
      const back = r.proposed.length > 0 ? r.proposed.join(', ') : '—';
      const ref = r.refIdentical === undefined ? '' : r.refIdentical ? 'same' : 'respelled';
      L.push(`| \`${r.id}\` | ${esc(r.feature)} | ${esc(r.construct)} | \`${r.channel}\` | ${r.expect} | ${esc(back)} | ${ref} | ${r.channelAs ? `\`${r.channelAs}\`` : ''} | ${esc(clip(r.note, 240))} |`);
    }
    L.push('');
  }
  L.push('---');
  L.push('');
  L.push('*The seed each case round-trips is `extract/computed/out/conformance/<case>/enriched.contract.json`');
  L.push('— the contract the construct actually reached. `conformance/seeds/<id>.contract.json` is the');
  L.push('empty prop space the capture enumerated against and carries no construct.*');
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const write = argv.includes('--write');
  const report = argv.includes('--report');
  const onlyIdx = argv.indexOf('--case');
  const only = onlyIdx >= 0 ? argv[onlyIdx + 1] : undefined;
  const rows = await measureAllCanvas(only, only !== undefined);
  const counts = summarizeCanvas(rows);

  const order: Classification[] = ['SILENT', 'DRIFTED', 'HARMFUL', 'NAMED', 'REFUSED-BY-NAME', 'SEED-ABSENT', 'ROUND-TRIPPED'];
  for (const k of order) {
    const group = rows.filter((r) => r.classification === k);
    if (group.length === 0) continue;
    const tag = k === 'SILENT'
      ? ' (RED — never waivable: the construct vanished and nothing says so)'
      : k === 'DRIFTED' ? ' (RED — a wrong answer came back and nothing named the lowering)'
        : k === 'HARMFUL' ? ' (RED — the canvas drew what the manifest says it cannot)' : '';
    console.log(`\n${k}${tag} — ${group.length}`);
    for (const r of group) {
      const detail = k === 'ROUND-TRIPPED'
        ? `${r.seed.join(', ')}${r.note ? ` (${r.note})` : ''}`
        : r.note || `seed ${r.seed.join(', ')}; proposal carries nothing on this channel; ${r.codeOnlyFacts} code-only fact(s), none of them this`;
      console.log(`  ${r.id.padEnd(34)} ${r.channel.padEnd(24)} ${r.expect.padEnd(8)} ${r.reached.padEnd(7)} ${detail}`);
    }
  }
  const red = RED_CLASSIFICATIONS.reduce((n, k) => n + counts[k], 0);
  console.log(
    `\nconformance:canvas: ${rows.length} cases · ${counts['ROUND-TRIPPED']} round-tripped · ${counts.NAMED} named · ${counts['REFUSED-BY-NAME']} refused by name · ${counts['SEED-ABSENT']} seed-absent · ${red} red (${counts.SILENT} SILENT, ${counts.DRIFTED} DRIFTED, ${counts.HARMFUL} HARMFUL)`,
  );

  if (only) process.exit(0);
  if (write || report) {
    writeFileSync(CANVAS_EXPECTATIONS, renderCanvasReport(rows));
    console.log(`\nCANVAS-EXPECTATIONS.md written.`);
  }
  if (write) {
    writeFileSync(CANVAS_BASELINE, JSON.stringify(baselineFileOf(rows), null, 2) + '\n');
    console.log(`CANVAS-BASELINE.json written (${rows.length} cases). This is an EXPLICIT act — review the diff.`);
    process.exit(0);
  }
  const drift = compareToCanvasBaseline(rows);
  if (drift.length) {
    console.log(`\n✖ CANVAS ROUND-TRIP DRIFT — ${drift.length}`);
    for (const d of drift) console.log(`  - ${d}`);
    process.exit(1);
  }
  console.log(`✔ no drift against conformance/CANVAS-BASELINE.json${counts.SILENT > 0 ? ` — ${counts.SILENT} SILENT still open (red, never waivable)` : ''}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(HERE, 'canvas.ts')) {
  main().catch((e: unknown) => {
    console.error(`✖ conformance:canvas: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
    process.exit(1);
  });
}
