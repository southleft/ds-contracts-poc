/**
 * LIBRARY COVERAGE SCORECARD — the honest rollup a lead budgets with (G6).
 *
 *   npm run extract:computed:scorecard -- --dir extract/computed/out/tailwind \
 *     [--config extract/computed/configs/tailwind.json] [--write]
 *
 * Per-component capture already emits the honest numbers (scorecard.json:
 * the fidelity gate; enriched.extension.json: every named refusal;
 * review-queue.json: open contradictions; source-bindings.json: the
 * library's own stylesheet naming its tokens). What was missing is the
 * LIBRARY-LEVEL view: one table, one totals line, and — the top line the
 * docs/18 lead asked for — "N components unmeasurable/skipped" counted BY
 * NAME, never folded into an average.
 *
 * Numbers are read, never recomputed: floor % is the gate's computed
 * equality (cells weighted, so a 240-combo Button does not average against
 * a 16-combo Card as an equal); refusals are the extension sidecar's named
 * entries (docs/16: refusal is named, never silent); open queue subtracts
 * the decisions ledger. A component with no capture output contributes
 * NOTHING to the floor — it is named as unmeasurable instead.
 *
 * PURE CORE + thin shell: coverageRow/libraryScorecard are pure over the
 * artifact JSON (unit-pinned in packages/cli/test/library-scorecard.test.ts).
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Pure core — artifact JSON in, rows/lines out
// ---------------------------------------------------------------------------

export interface ScorecardLike {
  component?: string;
  combos?: number;
  computed?: { cellsCompared: number; cellsEqual: number; pctEqual: number; rows: number; rowsFullyEqual: number };
  pixel?: { pairs: number; perfectAA: number };
}

export interface ExtensionLike {
  codeOnlyChannels?: unknown[];
  pairwiseRefusals?: unknown[];
  stateOverflow?: unknown[];
  bindingContradictions?: unknown[];
}

export interface ComponentArtifacts {
  scorecard: ScorecardLike | null;
  extension: ExtensionLike | null;
  /** review-queue.json items (ids), or null when absent. */
  queueIds: string[] | null;
  /** decisions.json resolved item ids, or null when absent. */
  decidedIds: string[] | null;
  /** source-bindings.json facts count, or null when the reader was off. */
  sourceFacts: number | null;
}

export interface CoverageRow {
  name: string;
  measured: boolean;
  floorPct: number | null;
  cellsCompared: number;
  cellsEqual: number;
  combos: number;
  pixelPerfect: string;
  sourceFacts: number | null;
  namedRefusals: number;
  refusalBreakdown: Record<string, number>;
  openQueue: number;
}

export function coverageRow(name: string, a: ComponentArtifacts): CoverageRow {
  const sc = a.scorecard;
  const ext = a.extension ?? {};
  const breakdown: Record<string, number> = {
    codeOnlyChannels: ext.codeOnlyChannels?.length ?? 0,
    pairwiseRefusals: ext.pairwiseRefusals?.length ?? 0,
    stateOverflow: ext.stateOverflow?.length ?? 0,
    bindingContradictions: ext.bindingContradictions?.length ?? 0,
  };
  const decided = new Set(a.decidedIds ?? []);
  const openQueue = (a.queueIds ?? []).filter((id) => !decided.has(id)).length;
  return {
    name,
    measured: sc?.computed !== undefined,
    floorPct: sc?.computed?.pctEqual ?? null,
    cellsCompared: sc?.computed?.cellsCompared ?? 0,
    cellsEqual: sc?.computed?.cellsEqual ?? 0,
    combos: sc?.combos ?? 0,
    pixelPerfect: sc?.pixel ? `${sc.pixel.perfectAA}/${sc.pixel.pairs}` : '—',
    sourceFacts: a.sourceFacts,
    namedRefusals: Object.values(breakdown).reduce((n, v) => n + v, 0),
    refusalBreakdown: breakdown,
    openQueue,
  };
}

/** R3: one quarantined component, read from its committed refusal.json. */
export interface QuarantineRow {
  name: string;
  reason: string;
  detail: string[];
}

export interface LibraryScorecard {
  library: string;
  rows: CoverageRow[];
  /** Configured components with NO capture output — unmeasurable, by name. */
  unmeasured: string[];
  /** CONFORMANCE FRONTIER (R3): components the run QUARANTINED — a channel the
   *  generator registry refuses, scoped to the component. They shipped a
   *  capture and a refusal and NO CONTRACT, so they are not "unmeasured" (the
   *  measurement exists) and they are certainly not in the floor. A quarantine
   *  is a defect with a name, and the rollup a lead budgets with has to show
   *  it or the library reads as complete when a component is missing. */
  quarantined: QuarantineRow[];
  totals: {
    measured: number;
    weightedFloorPct: number | null;
    cellsCompared: number;
    namedRefusals: number;
    openQueue: number;
    quarantined: number;
  };
  lines: string[];
}

const pad = (s: string, w: number): string => (s.length >= w ? s : s + ' '.repeat(w - s.length));
const rpad = (s: string, w: number): string => (s.length >= w ? s : ' '.repeat(w - s.length) + s);

/** PURE: rows (+ configured-but-uncaptured names) → the library scorecard.
 *  Deterministic: rows render in the given order; unmeasured sorts. */
export function libraryScorecard(library: string, rows: CoverageRow[], unmeasured: string[], quarantined: QuarantineRow[] = []): LibraryScorecard {
  const measured = rows.filter((r) => r.measured);
  const cellsCompared = measured.reduce((n, r) => n + r.cellsCompared, 0);
  const cellsEqual = measured.reduce((n, r) => n + r.cellsEqual, 0);
  const weightedFloorPct = cellsCompared > 0 ? (cellsEqual / cellsCompared) * 100 : null;
  const namedRefusals = rows.reduce((n, r) => n + r.namedRefusals, 0);
  const openQueue = rows.reduce((n, r) => n + r.openQueue, 0);
  const sortedUnmeasured = [...unmeasured].sort();

  const lines: string[] = [
    `Library coverage — ${library}`,
    '',
    `${pad('component', 16)} ${rpad('floor %', 8)} ${rpad('combos', 7)} ${rpad('px-perfect', 11)} ${rpad('src-facts', 10)} ${rpad('refusals', 9)} ${rpad('open-queue', 11)}`,
  ];
  for (const r of rows) {
    lines.push(
      `${pad(r.name, 16)} ${rpad(r.floorPct === null ? '—' : r.floorPct.toFixed(1), 8)} ${rpad(String(r.combos || '—'), 7)} ${rpad(r.pixelPerfect, 11)} ${rpad(r.sourceFacts === null ? '—' : String(r.sourceFacts), 10)} ${rpad(String(r.namedRefusals), 9)} ${rpad(String(r.openQueue), 11)}`,
    );
  }
  lines.push(
    '',
    `TOTALS: ${measured.length} component(s) measured · floor ${weightedFloorPct === null ? '—' : weightedFloorPct.toFixed(1) + '%'} (computed equality, weighted by ${cellsCompared} cells) · ${namedRefusals} named refusal(s) in extension sidecars · ${openQueue} open review-queue item(s)`,
  );
  if (sortedUnmeasured.length > 0) {
    lines.push(
      `${sortedUnmeasured.length} UNMEASURABLE/SKIPPED (configured, no capture output): ${sortedUnmeasured.join(', ')} — computed capture has not run for these; they are NOT in the floor above`,
    );
  } else {
    lines.push('0 unmeasurable/skipped — every configured component has capture output');
  }
  if (quarantined.length > 0) {
    lines.push(
      `${quarantined.length} QUARANTINED (captured, refused, NO CONTRACT SHIPPED): ${quarantined.map((q) => `${q.name} — ${q.reason}`).join(' · ')} — a quarantined component is NOT in the floor and NOT "unmeasured"; its capture exists and its contract was refused by name (see REFUSAL.md)`,
    );
  } else {
    lines.push('0 quarantined — every captured component produced a contract the generator registry accepts');
  }
  lines.push(
    'floor % = gate computed-equality (exact string, no tolerance) · src-facts = source-bindings facts (— = CSS-vars reader off) · refusals = named extension-sidecar entries (codeOnly + pairwise + stateOverflow + contradictions)',
  );

  return {
    library,
    rows,
    unmeasured: sortedUnmeasured,
    quarantined,
    totals: { measured: measured.length, weightedFloorPct, cellsCompared, namedRefusals, openQueue, quarantined: quarantined.length },
    lines,
  };
}

// ---------------------------------------------------------------------------
// Shell — fs only
// ---------------------------------------------------------------------------

const readJson = (p: string): unknown | null => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as unknown) : null);

export function artifactsFromDir(dir: string): ComponentArtifacts {
  const queue = readJson(path.join(dir, 'review-queue.json')) as { items?: { id: string }[] } | null;
  const decisions = readJson(path.join(dir, 'decisions.json')) as { ids: string[] }[] | null;
  const source = readJson(path.join(dir, 'source-bindings.json')) as { facts?: unknown[] } | null;
  return {
    scorecard: readJson(path.join(dir, 'scorecard.json')) as ScorecardLike | null,
    extension: readJson(path.join(dir, 'enriched.extension.json')) as ExtensionLike | null,
    queueIds: queue?.items ? queue.items.map((i) => i.id) : null,
    decidedIds: decisions ? decisions.flatMap((d) => d.ids) : null,
    sourceFacts: source?.facts ? source.facts.length : null,
  };
}

export function runLibraryScorecard(dirArg: string, configArg?: string, write = false): LibraryScorecard {
  const dirAbs = path.resolve(dirArg);
  if (!existsSync(dirAbs) || !statSync(dirAbs).isDirectory()) {
    throw new Error(`--dir not found or not a directory: ${dirArg}`);
  }
  const subdirs = readdirSync(dirAbs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(dirAbs, e.name, 'scorecard.json')))
    .map((e) => e.name)
    .sort();

  // Configured component list (capture-config components → out dirs are the
  // lowercased names, extract/computed/run.ts) — names the unmeasurable set.
  let configured: string[] | null = null;
  if (configArg) {
    const cfg = readJson(path.resolve(configArg)) as { components?: { name: string }[] } | null;
    if (!cfg?.components) throw new Error(`--config unreadable or has no components: ${configArg}`);
    configured = cfg.components.map((c) => c.name);
  }

  const rows = subdirs.map((name) => coverageRow(name, artifactsFromDir(path.join(dirAbs, name))));
  // R3: a quarantined component has a refusal.json and NO scorecard.json, so
  // it never appears in `subdirs` — it is discovered by its refusal, which is
  // the only artifact it is allowed to ship besides its capture.
  const quarantined = readdirSync(dirAbs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(dirAbs, e.name, 'refusal.json')))
    .map((e) => {
      const r = readJson(path.join(dirAbs, e.name, 'refusal.json')) as { component?: string; reason?: string; detail?: string[] } | null;
      return { name: r?.component ?? e.name, reason: r?.reason ?? 'refusal.json unreadable', detail: r?.detail ?? [] };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const captured = new Set([...subdirs, ...quarantined.map((q) => q.name.toLowerCase())]);
  const unmeasured = (configured ?? []).filter((n) => !captured.has(n.toLowerCase()));

  const result = libraryScorecard(path.basename(dirAbs), rows, unmeasured, quarantined);
  console.log(result.lines.join('\n'));
  if (write) {
    const outPath = path.join(dirAbs, 'library-scorecard.json');
    const { lines: _lines, ...json } = result;
    writeFileSync(outPath, JSON.stringify(json, null, 2) + '\n');
    console.log(`\n✔ machine-readable rollup → ${outPath}`);
  }
  return result;
}

// Direct-run shell (filename-matched).
if (process.argv[1] && /computed[\\/]library-scorecard\.(m?[tj]s)$/.test(path.resolve(process.argv[1]))) {
  const argv = process.argv.slice(2);
  const val = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i > -1 ? argv[i + 1] : undefined;
  };
  const dir = val('dir');
  if (!dir) {
    console.error('usage: tsx extract/computed/library-scorecard.ts --dir <out-root> [--config <capture-config.json>] [--write]');
    process.exit(2);
  }
  runLibraryScorecard(dir, val('config'), argv.includes('--write'));
}
