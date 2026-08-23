/**
 * The guided walkthrough's ENGINE calls — pure, data-in/data-out, importable
 * from node (playground/scripts/flow-check.ts) and from the browser alike.
 * Nothing here reads a file or a vite-only import; flow-data.ts supplies the
 * fixtures and tours.ts supplies the copy.
 *
 * Every number the walkthrough prints comes from one of these calls over a
 * committed input (a contract, a token tree, a fixture dump, a receipt
 * file), so the flow-check script can re-run the same calls headless and
 * refuse when the walkthrough and the receipts disagree. Self-attested
 * numbers are what the repo's truth rule forbids.
 *
 * What runs in the browser is exactly what `npm run core:browser-check`
 * proves: the core barrel (createFigmaEngine / compileComponentData, the
 * four emitters, proposeBatchFromDump / proposeFromDump). The one thing
 * that does NOT run here is extract/figma/roundtrip.ts's compareContracts
 * (it imports node:fs) — the Adjudicate step REPLAYS the committed
 * ROUNDTRIP.md rows and says so.
 */
import {
  ContractSchema,
  createFigmaEngine,
  ExactProjectionError,
  proposeBatchFromDump,
  proposeFromDump,
  provenanceSentence,
  tokenCorpusFromJson,
  type CanvasProvenance,
  type CodeOnlyFact,
  type ComponentData,
  type Contract,
  type EmittedFile,
  type TokenTreeInput,
} from '../../../core/index.js';
import { REST_DUMP_VERSION } from '../../../extract/figma/rest/map.js';
import type { DumpFile, DumpSet } from '../../../extract/figma/types.js';

/** The dump grammar BOTH producers write today (extract/figma/dump.plugin.js
 *  and extract/figma/rest/map.ts) — read from the REST mapper's exported
 *  constant, never typed as a literal here. A fixture is labelled by its OWN
 *  `_provenance.dumpVersion`, which may be older. */
export const PRODUCER_DUMP_GRAMMAR: string = REST_DUMP_VERSION;

// ---------------------------------------------------------------------------
// Hop 2 — compile (contract → canvas node specs + code-only facts)
// ---------------------------------------------------------------------------

export interface CompileReceipt {
  setName: string;
  contractId: string;
  /** The pure enum-API cartesian. */
  variantCount: number;
  /** `State=…` preview variants when bindings.figma.statePreviews is on. */
  stateVariantCount: number;
  firstVariantName: string | null;
  /** The slash variable name bound to the root fill of the first variant. */
  rootFill: string | null;
  textProps: ComponentData['textProps'];
  boolProps: ComponentData['boolProps'];
  /** ComponentData omits the key when empty (keeps specHash stable); the
   *  receipt always carries an array so "0 facts" is a stated count. */
  codeOnlyFacts: CodeOnlyFact[];
  statePreviews: boolean;
}

export function compileReceipt(
  contract: Contract,
  contracts: Map<string, Contract>,
  tokens: TokenTreeInput,
  icons: Map<string, string>,
): CompileReceipt {
  const brands = Object.keys(tokens.brands).length > 0 ? tokens.brands : { default: {} };
  const engine = createFigmaEngine({ tokens: { ...tokens, brands }, icons });
  const byId = new Map(contracts);
  byId.set(contract.id, contract);
  const data = engine.compileComponentData(contract, byId);
  const first = data.variants[0];
  const spec = first?.spec as { fill?: unknown } | undefined;
  return {
    setName: data.setName,
    contractId: data.contractId,
    variantCount: data.variants.length,
    stateVariantCount: data.stateVariants?.length ?? 0,
    firstVariantName: first?.name ?? null,
    rootFill: typeof spec?.fill === 'string' ? spec.fill : null,
    textProps: data.textProps,
    boolProps: data.boolProps,
    codeOnlyFacts: data.codeOnlyFacts ?? [],
    statePreviews: contract.bindings.figma.statePreviews === true,
  };
}

/** A committed bundle's per-contract fact list, in the shape
 *  `ds-contracts figma bundle` writes (`bundle.codeOnlyFacts[i]`). */
export interface BundleFactRow {
  contractId: string;
  name: string;
  facts: CodeOnlyFact[];
}

/** The contract's LIVE compile against the committed bundle's row for it:
 *  same count and the same (part, kind, channel, value) keys in the same
 *  order, or a named difference. */
export function factsAgreeWithBundle(
  live: CodeOnlyFact[],
  bundleRow: BundleFactRow | undefined,
): { agree: boolean; detail: string } {
  if (!bundleRow) return { agree: false, detail: 'the committed bundle carries no row for this contract' };
  const key = (f: CodeOnlyFact) => [f.part, f.kind, f.channel, f.value].join(' · ');
  const a = live.map(key);
  const b = bundleRow.facts.map(key);
  if (a.length !== b.length) {
    return { agree: false, detail: `live compile has ${a.length} facts, the committed bundle has ${b.length}` };
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return { agree: false, detail: `row ${i + 1} differs: live "${a[i]}" vs bundle "${b[i]}"` };
  }
  return { agree: true, detail: `${a.length} facts, identical keys in the same order` };
}

// ---------------------------------------------------------------------------
// Text anchors — a fact → the line that states it
// ---------------------------------------------------------------------------

/** First 0-based line of `text` containing `needle`, or null. Same honesty
 *  rule as refusal-lines.ts: no line is better than a guessed one. */
export function locateNeedle(text: string, needle: string): number | null {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => l.includes(needle));
  return idx === -1 ? null : idx;
}

/** The needle a code-only fact is stated by in its contract's JSON text.
 *  `declared` and `channel` facts are `"channel": "value"` pairs; an event
 *  is its `"name"` entry. Null when the fact has no single-line statement
 *  (gradients, shadows, meters) — the row then shows without a jump. */
export function factNeedle(fact: CodeOnlyFact): string | null {
  if (fact.kind === 'event') return `"name": "${fact.channel}"`;
  if (fact.kind === 'declared' || fact.kind === 'channel') return `"${fact.channel}": "${fact.value}"`;
  return null;
}

export interface Excerpt {
  path: string;
  /** 1-based line of the hit. */
  line: number;
  totalLines: number;
  rows: Array<{ n: number; text: string; hit: boolean }>;
}

/** The emitted file line that carries `needle`, with `context` lines either
 *  side — for showing ONE line of a 2,000-line script without pretending
 *  the rest is not there. Null when no emitted file carries it. */
export function excerptOf(files: EmittedFile[], needle: string, context = 3): Excerpt | null {
  for (const file of files) {
    const lines = file.contents.split('\n');
    const i = lines.findIndex((l) => l.includes(needle));
    if (i === -1) continue;
    const from = Math.max(0, i - context);
    const to = Math.min(lines.length - 1, i + context);
    const rows = [];
    for (let n = from; n <= to; n += 1) rows.push({ n: n + 1, text: lines[n], hit: n === i });
    return { path: file.path, line: i + 1, totalLines: lines.length, rows };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hop 4 — a dump, summarised; a set, proposed
// ---------------------------------------------------------------------------

export interface DumpSetSummary {
  name: string;
  variants: number;
  hasPropertyDefinitions: boolean;
  stamps: { contractId: string | null; specHash: string | null; version: string | null };
  semantics: { element?: string; role?: string } | null;
}

export interface DumpSummary {
  fileKey: string | null;
  extractedAt: string | null;
  /** The fixture's OWN label — null when the producer predates the field. */
  dumpVersion: string | null;
  note: string | null;
  sets: DumpSetSummary[];
  degradations: Array<{ code: string; nodePath: string; message: string }>;
  /** Whether the producer wrote a `_degradations` channel at all. */
  hasDegradationsChannel: boolean;
  capturedVariables: number;
}

const isSet = (v: unknown): v is DumpSet =>
  v !== null && typeof v === 'object' && Array.isArray((v as { variants?: unknown }).variants);

export function dumpSets(dump: Record<string, unknown>): Array<[string, DumpSet]> {
  return Object.entries(dump).filter((e): e is [string, DumpSet] => !e[0].startsWith('_') && isSet(e[1]));
}

export function summarizeDump(dump: Record<string, unknown>): DumpSummary {
  const prov = (dump as DumpFile)._provenance ?? {};
  const degr = (dump as { _degradations?: unknown })._degradations;
  const vars = (dump as { _variables?: unknown })._variables;
  return {
    fileKey: typeof prov.fileKey === 'string' ? prov.fileKey : null,
    extractedAt: prov.extractedAt === undefined ? null : String(prov.extractedAt),
    dumpVersion: typeof prov.dumpVersion === 'string' ? prov.dumpVersion : null,
    note: typeof prov.note === 'string' ? prov.note : null,
    sets: dumpSets(dump).map(([name, set]) => ({
      name,
      variants: set.variants.length,
      hasPropertyDefinitions: !!set.propertyDefinitions && Object.keys(set.propertyDefinitions).length > 0,
      stamps: {
        contractId: typeof set.contractId === 'string' ? set.contractId : null,
        specHash: typeof set.specHash === 'string' ? set.specHash : null,
        version: typeof set.version === 'string' ? set.version : null,
      },
      semantics: set.semantics ?? null,
    })),
    degradations: Array.isArray(degr)
      ? (degr as Array<{ code?: unknown; nodePath?: unknown; message?: unknown }>).map((d) => ({
          code: String(d.code ?? ''),
          nodePath: String(d.nodePath ?? ''),
          message: String(d.message ?? ''),
        }))
      : [],
    hasDegradationsChannel: Array.isArray(degr),
    capturedVariables: Array.isArray(vars) ? vars.length : vars && typeof vars === 'object' ? Object.keys(vars).length : 0,
  };
}

/** The label a fixture gets: its own `_provenance.dumpVersion`, or the
 *  plain statement that the capture predates the field. Never the
 *  producers' grammar — that is a claim about today's producers, not about
 *  this file. */
export function fixtureLabel(summary: DumpSummary): string {
  return summary.dumpVersion !== null
    ? `dump v${summary.dumpVersion} (the fixture's own _provenance.dumpVersion)`
    : 'dumpVersion absent — a capture that predates the _provenance.dumpVersion field';
}

/** The producer version at which the contractId stamp
 *  (`ds_contracts/contractId`) started being READ — extract/figma/types.ts
 *  documents it on `DumpSet.contractId`; flow-check.ts pins the two
 *  against each other. A fixture older than it cannot say whether the set
 *  was tool-generated. */
export const CONTRACT_ID_STAMP_SINCE = 1.26;

/** The plugin's rule (figma-sync/plugin/engine/entry.ts: `toolGenerated`
 *  true → "tool-generated", false → "hand-built", unknown → "unrecorded"),
 *  applied to a fixture: a set carrying the contractId stamp is
 *  tool-generated; a set without one on a producer that READS the stamp is
 *  hand-built; a capture older than the stamp channel cannot say. */
export function canvasProvenanceOf(set: DumpSet, summary: DumpSummary): CanvasProvenance {
  if (typeof set.contractId === 'string' && set.contractId.length > 0) return 'tool-generated';
  const v = summary.dumpVersion === null ? null : Number.parseFloat(summary.dumpVersion);
  if (v !== null && Number.isFinite(v) && v >= CONTRACT_ID_STAMP_SINCE) return 'hand-built';
  return 'unrecorded';
}

export type ProjectionMode = 'exact' | 'reviewable-inversion';

export interface ProposeFixtureInput {
  dump: Record<string, unknown>;
  setName: string;
  corpus: ReturnType<typeof tokenCorpusFromJson>;
  contractsById: Map<string, Contract>;
  projectionMode: ProjectionMode;
  mintUnbound: boolean;
}

export type ProposedSet = ReturnType<typeof proposeBatchFromDump>['proposals'][number];

export interface ProposeFixtureResult {
  mode: ProjectionMode;
  proposal: ProposedSet | null;
  skipped: ReturnType<typeof proposeBatchFromDump>['skipped'];
  batchNotes: string[];
  /** What EXACT mode says about this set, by code — run regardless of the
   *  mode chosen so the reason for a reviewable run is on screen. */
  exactRefusal: { code: string; message: string } | null;
  provenance: CanvasProvenance;
  provenanceSentence: string;
}

/** The exact-mode verdict for one set: null when exact proposes it, else
 *  the ExactProjectionError's code + message, verbatim. Any other throw
 *  is re-raised — only the named refusal class is a verdict. */
export function exactRefusalOf(
  set: DumpSet,
  opts: { corpus: ProposeFixtureInput['corpus']; contractIdByName: Map<string, string>; fileKey: string | null },
): { code: string; message: string } | null {
  try {
    proposeFromDump(set, { ...opts, projectionMode: 'exact' });
    return null;
  } catch (e) {
    if (e instanceof ExactProjectionError) return { code: e.code, message: e.message };
    throw e;
  }
}

/** ONE set of a fixture dump → its proposal (or its named skip), run by the
 *  SAME proposeBatchFromDump the JSON tab, the plugin Send tab and the CLI
 *  run. The dump's `_provenance` / `_degradations` / `_variables` channels
 *  travel with the set so captured variables and read-limit notes ride. */
export function proposeFixtureSet(input: ProposeFixtureInput): ProposeFixtureResult {
  const summary = summarizeDump(input.dump);
  const set = input.dump[input.setName];
  if (!isSet(set)) throw new Error(`fixture has no component set named "${input.setName}"`);
  const slice: Record<string, unknown> = { [input.setName]: set };
  for (const channel of ['_provenance', '_degradations', '_variables']) {
    if (channel in input.dump) slice[channel] = input.dump[channel];
  }
  const contractIdByName = new Map([...input.contractsById.values()].map((c) => [c.name, c.id]));
  const contractIdByKey = new Map(
    [...input.contractsById.values()]
      .filter((c) => c.bindings.figma.anchors.componentSetKey !== null)
      .map((c) => [c.bindings.figma.anchors.componentSetKey!, c.id]),
  );
  const fileKey = summary.fileKey;
  const exactRefusal = exactRefusalOf(set, { corpus: input.corpus, contractIdByName, fileKey });
  const batch = proposeBatchFromDump(slice, {
    corpus: input.corpus,
    contractIdByName,
    contractIdByKey,
    contractsById: input.contractsById,
    fileKey,
    mintUnbound: input.mintUnbound,
    projectionMode: input.projectionMode,
  });
  const provenance = canvasProvenanceOf(set, summary);
  return {
    mode: input.projectionMode,
    proposal: batch.proposals[0] ?? null,
    skipped: batch.skipped,
    batchNotes: batch.notes,
    exactRefusal,
    provenance,
    provenanceSentence: provenanceSentence(provenance),
  };
}

/** The same set with its `propertyDefinitions` removed IN MEMORY — the Break
 *  step's input. The fixture on disk is never touched. */
export function withoutPropertyDefinitions(dump: Record<string, unknown>, setName: string): Record<string, unknown> {
  const set = dump[setName];
  if (!isSet(set)) throw new Error(`fixture has no component set named "${setName}"`);
  const { propertyDefinitions: _dropped, ...rest } = set;
  void _dropped;
  return { ...dump, [setName]: rest };
}

/** A corpus from a bundle's tokenSet (base + minted trees) — the corpus the
 *  bundle's contracts were compiled against, for hex→token matching. */
export function corpusFromTokenSet(base: Record<string, unknown>, minted: Record<string, unknown> | null) {
  return tokenCorpusFromJson({ primitives: base, semantic: minted ?? {}, light: {}, brandDefault: {} });
}

/** Parse a raw contract document through the schema — the fixture-bundle
 *  contracts arrive as raw bytes, exactly as `figma bundle` stores them. */
export function parseContract(raw: unknown): Contract {
  return ContractSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Hop 5 — the CONTRACT-PROPOSAL envelope, in the plugin's v2 shape
// ---------------------------------------------------------------------------

export interface EnvelopePreview {
  envelope: Record<string, unknown>;
  /** Fields of the plugin's envelope this preview could NOT fill from a
   *  fixture, each with the reason. Named, never invented. */
  omitted: Array<{ field: string; reason: string }>;
}

/** The envelope `figma-sync/plugin/engine/entry.ts` exports from the Send
 *  tab, assembled from a proposal: `{type, baseContractId, baseVersion,
 *  setName, summary, proposedContract, projection, proposalNotes,
 *  childStubs?, mintedTokens?, provenance{toolGenerated, kind, note},
 *  baseFreshness}`. `baseFreshness` needs the live set's specHash stamp
 *  compared to the base contract's — a fixture without a specHash cannot
 *  produce it, so the field is omitted and listed, not faked. */
export function envelopePreview(
  result: ProposeFixtureResult,
  base: Contract | null,
  setSpecHash: string | null,
): EnvelopePreview | null {
  const proposal = result.proposal;
  if (!proposal) return null;
  const omitted: EnvelopePreview['omitted'] = [];
  const envelope: Record<string, unknown> = {
    type: 'CONTRACT-PROPOSAL',
    baseContractId: base ? base.id : null,
    baseVersion: base ? base.version : null,
    setName: proposal.setName,
    summary: [],
    proposedContract: proposal.contract,
    projection: proposal.projection,
    proposalNotes: proposal.notes,
    ...(proposal.childStubs && proposal.childStubs.length > 0 ? { childStubs: proposal.childStubs } : {}),
    ...(proposal.mintedTokens ? { mintedTokens: proposal.mintedTokens } : {}),
    provenance: {
      toolGenerated: result.provenance === 'unrecorded' ? null : result.provenance === 'tool-generated',
      kind: result.provenance,
      note: result.provenanceSentence,
    },
  };
  omitted.push({
    field: 'summary',
    reason: 'the plugin composes the summary lines from the live Send panel (counts, the stale-base warning); a fixture replay has none to add',
  });
  if (setSpecHash === null) {
    omitted.push({
      field: 'baseFreshness',
      reason: 'needs the set’s ds_contracts/specHash stamp compared to the base contract’s — this fixture carries no specHash stamp',
    });
  } else if (!base) {
    omitted.push({
      field: 'baseFreshness',
      reason: 'needs a base contract to compare the set’s specHash against — none is in scope for this set',
    });
  } else {
    omitted.push({
      field: 'baseFreshness',
      reason: `the verdict compares the set’s specHash (${setSpecHash}) with the base contract’s current emit; that comparison runs in the plugin against the live file, not replayed here`,
    });
  }
  return { envelope, omitted };
}

// ---------------------------------------------------------------------------
// Adjudicate — the committed ROUNDTRIP.md rows, replayed
// ---------------------------------------------------------------------------

export interface RoundtripRows {
  component: string;
  matched: string[];
  canvasAbsent: Array<{ subject: string; reason: string }>;
  mismatch: string[];
  /** The summary-table counts, as printed. */
  counts: { matched: number; canvasAbsent: number; mismatch: number };
}

/** Parse one component's section out of extract/figma/ROUNDTRIP.md (a
 *  generated receipt — see its header). Refuses when the section's list
 *  lengths disagree with the summary table, so a hand-edited receipt cannot
 *  replay as truth. */
export function parseRoundtripReceipt(md: string, component: string): RoundtripRows {
  const tableRow = md.split('\n').find((l) => l.startsWith(`| ${component} |`));
  if (!tableRow) throw new Error(`ROUNDTRIP.md has no summary row for ${component}`);
  const cells = tableRow.split('|').map((c) => c.trim());
  const counts = { matched: Number(cells[2]), canvasAbsent: Number(cells[3]), mismatch: Number(cells[4]) };
  const start = md.indexOf(`\n## ${component}\n`);
  if (start === -1) throw new Error(`ROUNDTRIP.md has no section for ${component}`);
  const rest = md.slice(start + 1);
  const next = rest.indexOf('\n## ', 1);
  const section = next === -1 ? rest : rest.slice(0, next);

  const block = (title: string): string | null => {
    const m = section.match(new RegExp(`### ${title} \\((\\d+)\\)[^\\n]*\\n([\\s\\S]*?)(?=\\n### |$)`));
    return m ? m[2].trim() : null;
  };
  const matchedBlock = block('MATCHED') ?? '';
  const matched = [...matchedBlock.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const absentBlock = block('CANVAS-ABSENT') ?? '';
  const canvasAbsent = absentBlock
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => {
      const m = l.match(/^- `([^`]+)` — (.*)$/);
      if (!m) throw new Error(`ROUNDTRIP.md CANVAS-ABSENT row not parseable: ${l}`);
      return { subject: m[1], reason: m[2] };
    });
  const mismatchBlock = block('MISMATCH') ?? '';
  const mismatch = mismatchBlock
    .split('\n')
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2));
  if (matched.length !== counts.matched || canvasAbsent.length !== counts.canvasAbsent || mismatch.length !== counts.mismatch) {
    throw new Error(
      `ROUNDTRIP.md ${component}: table says ${counts.matched}/${counts.canvasAbsent}/${counts.mismatch}, the section lists ${matched.length}/${canvasAbsent.length}/${mismatch.length}`,
    );
  }
  return { component, matched, canvasAbsent, mismatch, counts };
}

/** One LIVE cross-check beside the replay: the proposal's root token refs
 *  against the shipping contract's, channel by channel — the browser CAN
 *  compute this much of what compareContracts does, so it does. */
export function rootTokenAgreement(
  proposed: Record<string, unknown>,
  shipping: Contract,
): Array<{ channel: string; proposed: string | null; shipping: string | null; same: boolean }> {
  const p = ((proposed as { anatomy?: { root?: { tokens?: Record<string, string> } } }).anatomy?.root?.tokens ?? {}) as Record<string, string>;
  const s = (shipping.anatomy.root.tokens ?? {}) as Record<string, string>;
  const channels = [...new Set([...Object.keys(s), ...Object.keys(p)])].sort();
  return channels.map((channel) => ({
    channel,
    proposed: p[channel] ?? null,
    shipping: s[channel] ?? null,
    same: p[channel] === s[channel],
  }));
}
