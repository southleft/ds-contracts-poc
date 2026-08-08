import {
  diffChannelLines,
  toSnapshotChanges,
} from "../core/channel-diff.js";

/**
 * THE CANVAS-VARIANT SURFACE OF THE DIFFER — the Phase 1 exit criterion's
 * machinery, shared by `parity/diff.ts` and `parity/variant-drift-check.ts`.
 *
 * WHAT WAS MISSING, measured before this file existed:
 *
 *   $ grep -c getSharedPluginData parity/extract-figma.plugin.js   → 0
 *   $ grep -c getSharedPluginData extract/figma/dump.plugin.js     → 0
 *
 * core/emit-figma-script.ts stamps `ds_contracts/canvasFingerprint` and
 * `canvasSnapshot` on the set AND on every variant child, and
 * core/canvas-binding-check.ts proves the v6 hash covers part tree, layout
 * AND bindings-by-name. None of it was ever read back off the canvas. The
 * differ's Figma half compared property DEFINITIONS only — variant axes,
 * booleans, instance swaps — so a four-way part-layout edit inside ONE
 * variant (padding, itemSpacing, counter-axis alignment, a dropped binding)
 * projected to a byte-identical snapshot entry and `✔ Parity clean`.
 *
 * THE THREE COMPARISONS, and which one closes the exit criterion.
 *
 *   1. STAMPED vs LIVE  (`drift: 'canvas-edited'`)  ← THE EXIT CRITERION.
 *      The stamp records what the plugin last GENERATED. Nothing re-stamps
 *      when a designer drags a padding handle, so after a hand edit the
 *      stamp is stale and a fresh recompute over the same node disagrees.
 *      Both numbers are produced by the SAME fingerprint source in the SAME
 *      Figma session, so the comparison carries no cross-environment noise —
 *      it is exactly the plugin's own Check Drift verdict, transported.
 *
 *      THIS IS WHY parity/extract-figma.plugin.js DUMPS BOTH. Reading only
 *      getSharedPluginData — the shape this work was originally specified as
 *      — cannot close the criterion: a hand edit leaves the stamp untouched,
 *      so stamped-vs-contract stays clean and the edit is still invisible.
 *      The recompute is the fact the canvas can express; the stamp alone is
 *      a memory of a past generation.
 *
 *   2. STAMPED vs CONTRACT-COMPILED  (`drift: 'contract-divergent'`)
 *      The contract compiled offline through the real engine (buildEngineBundle
 *      → createFigmaMock → planGenerate, the path core/canvas-binding-check.ts
 *      already uses) and fingerprinted. A disagreement means the canvas was
 *      generated from a DIFFERENT contract revision than the one on disk.
 *
 *      HONEST STATUS: unverified across environments. Every fixture and gate
 *      here compares a compile against a compile, so equality holds by
 *      construction. Whether real Figma's node facts (font metrics resolving
 *      a fontName, sizing modes settling after a relayout) reproduce the mock's
 *      hash byte-for-byte has never been measured, because no committed
 *      snapshot carries `variants` yet. Until it is, this axis is reported
 *      with that caveat in its own remedy text and is NEVER the thing the
 *      exit criterion rests on.
 *
 *   3. VERSION HONESTY  (`drift: 'version-changed'` / `'unstamped'`)
 *      A stamp from an older scheme is NOT comparable, and calling it
 *      'canvas-edited' would be a false alarm on an untouched file. The
 *      spelling is lifted from figma-sync/plugin/engine/entry.ts's inventory
 *      walk rather than invented a second time.
 *
 * ABSENCE IS A NAMED GAP. A set with no `variants` array has never been
 * through an extraction that reads pluginData. That is reported as NOT
 * EXTRACTED — a finding — and never as "no drift". It is the single place
 * this surface could quietly become a false receipt.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { buildEngineBundle } from '../scripts/build-plugin-zip.mjs';
import { createFigmaMock } from '../scripts/plugin-engine-mock-figma.mjs';
import { FINGERPRINT_SRC, FINGERPRINT_VERSION } from '../core/canvas-fingerprint.js';

// ---------------------------------------------------------------------------
// Wire shape — what parity/extract-figma.plugin.js puts on each set
// ---------------------------------------------------------------------------

/** One variant row as the extraction plugin dumps it.
 *
 *  `fingerprint` / `snapshot` are READ from pluginData (what the plugin last
 *  stamped). `live` / `liveSnapshot` are RECOMPUTED in the same session over
 *  the node as it stands right now. Their disagreement is the hand edit. */
export interface FigmaVariantRow {
  name: string;
  /** stamped `ds_contracts/canvasFingerprint`, or null when never stamped. */
  fingerprint: string | null;
  /** stamped `ds_contracts/canvasSnapshot`, or null. */
  snapshot: string[] | null;
  /** fingerprint recomputed over the live node this extraction run. */
  live?: string | null;
  /** snapshot recomputed over the live node this extraction run. */
  liveSnapshot?: string[] | null;
  /** why this extraction could not produce a trustworthy live measurement. */
  measurementError?: string | null;
}

export type VariantDriftKind =
  | 'canvas-edited'
  | 'contract-divergent'
  | 'measurement-failed'
  | 'version-changed'
  | 'unstamped'
  | 'not-extracted';

export interface VariantDriftFinding {
  kind: VariantDriftKind;
  /** "Badge / Variant=Info" — the set and the VARIANT, never just the set. */
  subject: string;
  detail: string;
  remedy: string;
  /** paired line changes, `{ what, was, now }`, capped. */
  lines?: SnapshotChange[];
  /** False only for mock-to-live comparisons awaiting a compatibility receipt. */
  blocking?: boolean;
}

// ---------------------------------------------------------------------------
// The line diff — the SAME pairing rule figma-sync/plugin/code.js:527-552 uses
// ---------------------------------------------------------------------------

export interface SnapshotChange {
  what: string;
  was: string;
  now: string;
}

/** Line-set diff with `id|channel` prefix pairing.
 *
 *  Ported verbatim in BEHAVIOUR from figma-sync/plugin/code.js's
 *  `diffSnapshots` (the plugin copy is ES5 inside a template literal and
 *  cannot be imported). The prefix is the first TWO pipe-separated fields —
 *  the live finding recorded there was that truncating to the node id alone
 *  collided every fact on a node, so only the last one was ever compared and
 *  fill/description/propdef edits all vanished. */
export function diffSnapshots(storedLines: string[], freshLines: string[]): SnapshotChange[] {
  // Shared Wave 3 pairing vocabulary (`core/channel-diff.ts`). Plugin ES5
  // twin in code.js stays gate-pinned separately.
  return toSnapshotChanges(
    diffChannelLines(storedLines, freshLines, { whatIsPrefix: true }),
  );
}

// ---------------------------------------------------------------------------
// The offline compile — the contract's own canvas, fingerprinted
// ---------------------------------------------------------------------------

export interface CompiledSet {
  contractId: string | null;
  /** v6 fingerprint stamped on the generated set/standalone component. */
  setFingerprint: string;
  /** component-set-level metadata snapshot (description + property definitions). */
  setSnapshot: string[];
  /** variant name → v6 fingerprint of the compiled node. */
  fingerprints: Map<string, string>;
  /** variant name → the snapshot lines the fingerprint hashes. */
  snapshots: Map<string, string[]>;
}

export interface MockCanvas {
  figma: unknown;
  root: FigmaNodeLike & { findAll(pred: (n: FigmaNodeLike) => boolean): FigmaNodeLike[] };
  /** the fingerprint API with its name map ALREADY loaded from this mock. */
  fp: FingerprintApi;
  /** every generated top-level COMPONENT_SET / COMPONENT, in walk order. */
  sets: FigmaNodeLike[];
}

/** Build the offline canvas: the REAL engine bundle (in memory — the zip is
 *  never written) executed against the mocked Figma over every contract in
 *  `contractsDir`. The path core/canvas-binding-check.ts already uses.
 *
 *  No Figma, no network. ~0.7s for the 51 committed contracts, measured. */
export async function compileMockCanvas(contractsDir: string): Promise<MockCanvas> {
  const bundle = await buildEngineBundle();
  const { figma, root } = createFigmaMock();
  const sandbox: Record<string, unknown> = {
    window: {},
    TextEncoder,
    TextDecoder,
    console: { log() {}, warn() {}, error() {} },
  };
  vm.createContext(sandbox);
  vm.runInContext(bundle.code, sandbox, { timeout: 120_000 });
  const DSC = (sandbox.window as { DSC?: Record<string, Function> }).DSC;
  if (!DSC || typeof DSC.planGenerate !== 'function') {
    throw new Error('variant-drift: the engine bundle did not expose window.DSC.planGenerate');
  }

  const scriptContext = vm.createContext({ figma, console: { log() {}, warn() {}, error() {} } });
  const runScript = (code: string) =>
    vm.runInContext(`(async () => {\n${code}\n})()`, scriptContext, { timeout: 300_000 });

  const parsedContracts: unknown[] = [];
  for (const file of readdirSync(contractsDir).filter((f) => f.endsWith('.contract.json')).sort()) {
    const parsed = DSC.parseIncomingText(readFileSync(path.join(contractsDir, file), 'utf8')) as {
      ok: boolean;
      kind?: string;
      contracts?: unknown[];
    };
    if (!parsed.ok || parsed.kind !== 'contract' || !parsed.contracts) {
      throw new Error(`variant-drift: ${file} does not parse as a contract document`);
    }
    parsedContracts.push(...parsed.contracts);
  }
  const plan = DSC.planGenerate(parsedContracts, { withTokens: true, fileKey: '' }) as {
    ok: boolean;
    steps: Array<{ code: string }>;
    error?: string;
  };
  if (!plan.ok) throw new Error(`variant-drift: generate plan refused — ${plan.error ?? '(no reason given)'}`);
  for (const step of plan.steps) await runScript(step.code);

  // v6 REFUSES to compute over an unloaded name map, precisely so a forgotten
  // preload cannot masquerade as a canvas edit — three call sites already
  // forgot and every one reported a FALSE 'canvas-edited' on an untouched
  // file. The loader is the real one, awaited against the same mock the
  // stamps came from (an empty map would be equally wrong in the other
  // direction: the mock DOES serve variables).
  const fpApi = evalFingerprintApi();
  await withGlobalFigma(figma, () => fpApi.load());

  const nodes = (root as MockCanvas['root'])
    .findAll(
      (n: FigmaNodeLike) =>
        (n.type === 'COMPONENT_SET' || n.type === 'COMPONENT') &&
        Boolean(n.getSharedPluginData('ds_contracts', 'contractId')),
    )
    .filter((n) => !(n.type === 'COMPONENT' && n.parent?.type === 'COMPONENT_SET'));
  if (nodes.length === 0) {
    throw new Error('variant-drift: the compile produced no contract-marked component sets — refusing to report a clean canvas over nothing');
  }
  return { figma, root: root as MockCanvas['root'], fp: fpApi, sets: nodes };
}

/** The variant rows a SET (or standalone COMPONENT) stamps — mirrors
 *  core/emit-figma-script.ts's dsStampFingerprints exactly: a SET stamps each
 *  variant child, a standalone COMPONENT stamps itself. */
export function variantNodesOf(node: FigmaNodeLike): FigmaNodeLike[] {
  return node.type === 'COMPONENT_SET' ? (node.children ?? []) : [node];
}

/** Compile every contract in `contractsDir` and fingerprint each variant. */
export async function compileVariantFingerprints(contractsDir: string): Promise<Map<string, CompiledSet>> {
  const canvas = await compileMockCanvas(contractsDir);
  const out = new Map<string, CompiledSet>();
  for (const node of canvas.sets) {
    const fingerprints = new Map<string, string>();
    const snapshots = new Map<string, string[]>();
    for (const v of variantNodesOf(node)) {
      fingerprints.set(v.name, canvas.fp.fp(v));
      snapshots.set(v.name, canvas.fp.snap(v));
    }
    out.set(node.name, {
      contractId: node.getSharedPluginData('ds_contracts', 'contractId') || null,
      setFingerprint: canvas.fp.fp(node),
      setSnapshot: canvas.fp.setSnap(node),
      fingerprints,
      snapshots,
    });
  }
  return out;
}

export interface FigmaNodeLike {
  type: string;
  name: string;
  id?: string;
  key?: string;
  description?: string;
  componentPropertyDefinitions?: Record<string, { type: string; defaultValue: unknown; variantOptions?: string[] | null; preferredValues?: unknown }>;
  parent?: { type: string } | null;
  children?: FigmaNodeLike[];
  getSharedPluginData(ns: string, key: string): string;
  [k: string]: unknown;
}

export interface FingerprintApi {
  snap: (n: unknown) => string[];
  setSnap: (n: unknown) => string[];
  fp: (n: unknown) => string;
  load: () => Promise<Record<string, string>>;
  setNames: (m: Record<string, string>) => Record<string, string>;
}

/** The fingerprint evaluated FRESH from the canonical module — the same
 *  lockstep discipline plugin-engine-check and canvas-binding-check use, so
 *  this file can never compare against a stale private copy. */
export function evalFingerprintApi(): FingerprintApi {
  return new Function(
    `${FINGERPRINT_SRC}; return { snap: dsCanvasSnapshot, setSnap: dsCanvasSetSnapshot, fp: dsCanvasFingerprint, load: dsLoadVarNames, setNames: dsSetVarNames };`,
  )() as FingerprintApi;
}

async function withGlobalFigma<T>(figma: unknown, fn: () => Promise<T> | T): Promise<T> {
  const g = globalThis as { figma?: unknown };
  const prev = g.figma;
  g.figma = figma;
  try {
    return await fn();
  } finally {
    g.figma = prev;
  }
}

// ---------------------------------------------------------------------------
// The comparison
// ---------------------------------------------------------------------------

const MAX_LINES = 6;

export interface VariantDriftInput {
  /** the extracted set name (used in every subject). */
  setName: string;
  /** the set's `variants` array, or undefined when the extraction predates it. */
  variants: FigmaVariantRow[] | undefined;
  /** stamped fingerprint/snapshot on the component set itself. */
  setFingerprint?: string | null;
  setSnapshot?: string[] | null;
  /** same-session recomputation over the component set. */
  setLive?: string | null;
  setLiveSnapshot?: string[] | null;
  setMeasurementError?: string | null;
  /** the offline compile for the same set, when a contract matches it. */
  compiled: CompiledSet | undefined;
}

/** Compare ONE extracted set's variant rows. Returns findings, never throws. */
export function compareSetVariants(input: VariantDriftInput): VariantDriftFinding[] {
  const {
    setName,
    variants,
    compiled,
    setFingerprint,
    setSnapshot,
    setLive,
    setLiveSnapshot,
    setMeasurementError,
  } = input;
  const findings: VariantDriftFinding[] = [];
  // ABSENCE IS A NAMED GAP, NOT A PASS — handled by the caller so it can be
  // aggregated into one finding instead of one per set; see notExtractedFinding.
  if (!variants) return findings;

  const measurementFailure = (
    subject: string,
    error: string | null | undefined,
    target: 'component set' | 'variant',
  ): VariantDriftFinding => ({
    kind: 'measurement-failed',
    subject,
    detail: `live fingerprint measurement failed for this ${target}; stamped state cannot be trusted as proof of parity${error ? ` — ${error}` : ' — extraction returned no fingerprint and no error evidence'}`,
    remedy: 'Fix the extraction/variable lookup failure and re-run parity/extract-figma.plugin.js; this surface fails closed until a live fingerprint is measured',
  });

  // Set-level metadata is stamped separately from variant bulk. Description
  // and property-definition edits happen on the COMPONENT_SET, so variant-only
  // transport can never observe them.
  if (setFingerprint !== undefined || setLive !== undefined || setMeasurementError) {
    const subject = `${setName} / (component set)`;
    if (setMeasurementError || typeof setLive !== 'string' || !setLive) {
      findings.push(measurementFailure(subject, setMeasurementError, 'component set'));
    } else if (
      setFingerprint &&
      setFingerprint.startsWith(FINGERPRINT_VERSION) &&
      setSnapshot &&
      setLiveSnapshot &&
      diffSnapshots(setSnapshot, setLiveSnapshot).length > 0
    ) {
      const lines =
        setSnapshot && setLiveSnapshot ? diffSnapshots(setSnapshot, setLiveSnapshot).slice(0, MAX_LINES) : undefined;
      findings.push({
        kind: 'canvas-edited',
        subject,
        detail:
          `component-set metadata edited on the canvas since it was last generated — set snapshot changed (stamped ${setFingerprint}, live ${setLive})` +
          (lines && lines.length > 0 ? `; ${lines.map((c) => `${c.what}: ${c.was} → ${c.now}`).join(' | ')}` : ''),
        remedy: 'Adopt the metadata edit into the contract or re-run the component sync script',
        lines,
      });
    } else if (setFingerprint && !setFingerprint.startsWith(FINGERPRINT_VERSION)) {
      findings.push({
        kind: 'version-changed',
        subject,
        detail: `component-set fingerprint predates ${FINGERPRINT_VERSION} and is not comparable`,
        remedy: 'Regenerate the set to re-baseline its component-set metadata stamp',
      });
    } else if (!setFingerprint) {
      findings.push({
        kind: 'unstamped',
        subject,
        detail: 'component set carries no ds_contracts/canvasFingerprint, so its description and property definitions cannot be compared',
        remedy: 'Re-run the component sync script to baseline the set stamp, then re-extract snapshots',
      });
    }

    if (
      compiled &&
      typeof setFingerprint === 'string' &&
      setFingerprint.startsWith(FINGERPRINT_VERSION) &&
      setFingerprint !== compiled.setFingerprint
    ) {
      findings.push({
        kind: 'contract-divergent',
        blocking: false,
        subject,
        detail: `canvas set stamp ${setFingerprint} ≠ ${compiled.setFingerprint} recomputed by the mock contract compile`,
        remedy: 'INFORMATIONAL until a real-Figma compatibility receipt proves mock fingerprints equal live-Figma stamps; verify on the canvas before acting',
        lines: setSnapshot ? diffSnapshots(setSnapshot, compiled.setSnapshot).slice(0, MAX_LINES) : undefined,
      });
    }
  }

  for (const row of variants) {
    const subject = `${setName} / ${row.name}`;

    // A missing live result is never agreement, regardless of stamp state.
    // Preserve the measurement failure as its own machine-readable kind.
    if (row.measurementError || typeof row.live !== 'string' || !row.live) {
      findings.push(measurementFailure(subject, row.measurementError, 'variant'));
      continue;
    }

    // ── version honesty first. An older stamp is NOT comparable, and saying
    // 'canvas-edited' over it would be a false alarm on an untouched file.
    // Spelling lifted from figma-sync/plugin/engine/entry.ts:842.
    if (!row.fingerprint) {
      findings.push({
        kind: 'unstamped',
        subject,
        detail: `no ${FINGERPRINT_VERSION.slice(0, -1)} fingerprint on the variant — it carries no ds_contracts/canvasFingerprint, so nothing can be compared against it`,
        remedy: 'Re-run the component sync script for this set to baseline the stamp, then re-extract snapshots',
      });
      continue;
    }
    if (!row.fingerprint.startsWith(FINGERPRINT_VERSION)) {
      const older = /^v\d+:/.test(row.fingerprint) ? row.fingerprint.slice(0, row.fingerprint.indexOf(':') + 1) : '(unversioned)';
      findings.push({
        kind: 'version-changed',
        subject,
        detail: `fingerprint version changed (${older} → ${FINGERPRINT_VERSION}) — the stamp predates the current scheme and is not comparable; this is NOT a canvas edit`,
        remedy: 'Regenerate the set to re-baseline the stamp under the current scheme, then re-extract snapshots',
      });
      continue;
    }

    // ── 1. STAMPED vs LIVE — the hand edit. The exit criterion.
    if (typeof row.live === 'string' && row.live && row.live !== row.fingerprint) {
      const lines =
        row.snapshot && row.liveSnapshot ? diffSnapshots(row.snapshot, row.liveSnapshot).slice(0, MAX_LINES) : undefined;
      findings.push({
        kind: 'canvas-edited',
        subject,
        detail:
          `variant edited on the canvas since it was last generated — stamped ${row.fingerprint}, recomputed ${row.live}` +
          (lines && lines.length > 0
            ? `; ${lines.map((c) => `${c.what}: ${c.was} → ${c.now}`).join(' | ')}`
            : row.snapshot && row.liveSnapshot
              ? '; (hashes differ but no snapshot line pairs — the stored snapshot is stale relative to the stored hash)'
              : '; (no snapshot stored — re-extract with a plugin that dumps canvasSnapshot to see WHICH lines moved)'),
        remedy:
          'Adopt the edit into the contract (promotion) or re-run the component sync script to restore the generated geometry',
        lines,
      });
      continue; // the hand edit is the story; a contract comparison over an
      // edited node would restate it in a second, noisier voice.
    }

    // ── 2. STAMPED vs CONTRACT-COMPILED.
    const want = compiled?.fingerprints.get(row.name);
    if (compiled && want === undefined) {
      findings.push({
        kind: 'contract-divergent',
        blocking: false,
        subject,
        detail: `the Figma set carries variant "${row.name}" that the contract's compile does not produce`,
        remedy: 'Adopt into the contract (promotion) or re-run the component sync script',
      });
      continue;
    }
    if (want !== undefined && want !== row.fingerprint) {
      const compiledSnap = compiled!.snapshots.get(row.name);
      const lines = row.snapshot && compiledSnap ? diffSnapshots(row.snapshot, compiledSnap).slice(0, MAX_LINES) : undefined;
      findings.push({
        kind: 'contract-divergent',
        blocking: false,
        subject,
        detail:
          `canvas stamp ${row.fingerprint} ≠ ${want} recomputed from the contract — the set was generated from a different contract revision` +
          (lines && lines.length > 0 ? `; ${lines.map((c) => `${c.what}: ${c.was} → ${c.now}`).join(' | ')}` : ''),
        remedy:
          'Re-run the component sync script to regenerate from the current contract. NOTE: this axis compares a mocked compile against a live-Figma stamp and that equality is UNVERIFIED across environments (no committed snapshot carries `variants` yet) — confirm against the canvas before acting on it.',
        lines,
      });
    }
  }

  // A variant the contract compiles that the canvas does not carry.
  if (compiled) {
    const have = new Set(variants.map((v) => v.name));
    for (const name of compiled.fingerprints.keys()) {
      if (have.has(name)) continue;
      findings.push({
        kind: 'contract-divergent',
        blocking: false,
        subject: `${setName} / ${name}`,
        detail: `the contract compiles variant "${name}" but the Figma set does not carry it`,
        remedy: 'Re-run the component sync script',
      });
    }
  }

  return findings;
}

/** ONE finding for every set whose extraction carries no `variants` array.
 *
 *  Aggregated on purpose: 49 identical rows is a firehose, and the fact is
 *  singular — this snapshot came from an extraction that does not read
 *  pluginData at all. Returns null only when every set was extracted. */
export function notExtractedFinding(setNames: string[], total: number): VariantDriftFinding | null {
  if (setNames.length === 0) return null;
  const shown = setNames.slice(0, 8);
  return {
    kind: 'not-extracted',
    subject: 'canvas-variant-fingerprints',
    detail:
      `${setNames.length} of ${total} extracted set(s) carry no \`variants\` array, so per-variant canvas drift was NOT CHECKED — this is an unmeasured surface, not a clean one` +
      ` (${shown.join(', ')}${setNames.length > shown.length ? `, +${setNames.length - shown.length} more` : ''})`,
    remedy:
      'Re-run parity/extract-figma.plugin.js in the live Figma file with the current version (it reads ds_contracts/canvasFingerprint + canvasSnapshot per variant and recomputes both) and save fresh parity/snapshots/figma-components.json',
  };
}
