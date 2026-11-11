/*  THE READING HARNESS: one direction's run receipts in, the committed scorer's reading out (Step 1; reviewer,
 *  2026-11-10). Every value comes from a named receipt, never a guess; a set missing one is refused by name.
 *
 *  Figma to React: --f2r <cells.json>, a list of { set, dump, grammar, check?, failed? }:
 *    dump     the set's dump (variants, nodes for the icon and glyph test, the skeleton value);
 *    grammar  the classifier's verdicts for that dump (`npx tsx extract/figma/grammar.ts <dump>`);
 *    check    the check's verdicts ({ counts } or { check: { counts } }), or `failed`: why the conversion stopped.
 *  React to Figma: --r2f <stories.json> --checks <checks.json>, the reader's output and, per component title,
 *    { check } (react-to-figma.json) or { failed } or { refused } (the contracts step's refusal reason).
 *  --coverage <file> is the system's full grammar reading (the reader's grammar-only output, or a Figma classification
 *  of every set), for system coverage beside the run's own subset coverage; without it the first line says so.
 *  --profile <profile.json> gives the skeleton and internal markers and the pairs. With pairs, a reading that holds
 *  members of the largest paired unit is also read without them, labeled "sensitivity: without the <unit> unit".
 *  Deterministic; no model call. Frozen with the checker on 2026-11-20.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { domDrawing, drawnColumn, dumpDrawing, figmaInternal, figmaSkeletonOnly, reading, type SetResult } from '../extract/figma/scoreboard.js';
import { readProfile, type SystemProfile } from './storybook-reader.js';

type Counts = { pass: number; fail: number; unverified: number; 'font-blocked': number };
const json = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const refuse = (set: string, field: string): never => { throw Error(`reading-receipt-missing:${field}:${set}`); };
// A check's counts: the first of `counts`, `check.counts` and `verdicts` that is an object (in the React to Figma
// receipt `counts` is whether the set counts, and `verdicts` holds the counts). A check that records a stopped
// conversion (a status such as `refused` or `build-failed`, with its reason or error) passes none. Anything else
// without counts is refused by name, and so is a set that does not count yet passes a variant.
const countsOf = (f: string, set: string): Counts | null => { const r = json(f), c = [r.counts, r.check?.counts, r.verdicts].find((v) => v !== null && typeof v === 'object');
  if (!c && r.status && !['pass', 'fail'].includes(r.status) && (r.reason || r.error)) return null;
  if (r.counts === false && c?.pass > 0) throw Error(`reading-receipt-inconsistent:counts:${set}`);
  return c && typeof c.pass === 'number' ? c : refuse(set, 'counts'); };

export interface Cell { set: string; dump: string; grammar: string; check?: string; failed?: string }
/** Figma to React: one SetResult per cell. `columns: false` reads every set into the headline (for replays of runs
 *  scored before the columns existed). */
export function f2rSets(cells: readonly Cell[], profile?: SystemProfile, columns = true): SetResult[] {
  return cells.map((c) => {
    const dump = json(c.dump), entry = Object.entries<any>(dump).find(([, v]) => Array.isArray(v?.variants) && v.nodeId === c.set) ?? refuse(c.set, 'dump');
    const [key, set] = entry, verdict = json(c.grammar)[key] ?? refuse(c.set, 'grammar');
    if (!c.check && !c.failed) refuse(c.set, 'check');
    const k = c.check ? countsOf(c.check, c.set) : null, name = `${c.set} ${set.setName}`;
    if (figmaInternal(set.setName, profile?.figmaInternal)) return { set: name, grammar: verdict.grammar, variants: set.variants.length, pass: 0, fontBlocked: 0, internal: true };
    const column = !columns ? undefined : figmaSkeletonOnly(set, profile?.figmaSkeleton) ? 'skeleton-only' as const : drawnColumn(set.variants.map(dumpDrawing));
    return { set: name, grammar: verdict.grammar, variants: set.variants.length, pass: k?.pass ?? 0, fontBlocked: k?.['font-blocked'] ?? 0, ...(column ? { column } : {}) };
  });
}

/** React to Figma: one SetResult per reader component; excluded titles count in coverage only. */
export function r2fSets(stories: any, checks: Record<string, { check?: string; failed?: string; refused?: string }>, columns = true): SetResult[] {
  const sets: SetResult[] = (stories.excluded ?? []).map((e: any) => ({ set: e.title, grammar: e.grammar.grammar, variants: 0, pass: 0, fontBlocked: 0, excluded: e.reason }));
  for (const c of stories.components) {
    const r = checks[c.title] ?? refuse(c.title, 'check'), ok = c.matrix.status === 'ok';
    if (!r.check && !r.failed && !r.refused) refuse(c.title, 'check');
    const k = r.check ? countsOf(r.check, c.title) : null;
    const left = (c.leftOut ?? []).filter((l: any) => l.reason === 'left-out-variant').length;
    const draw = c.references.map((x: any) => (x.content && x.painted !== undefined && x.held !== undefined ? domDrawing(x.content, x.painted, x.held) : null));
    const column = !columns ? undefined : c.skeleton ? 'skeleton-only' as const : drawnColumn(draw);
    sets.push({ set: c.title, grammar: c.grammar.grammar, variants: ok ? c.matrix.variants : 0, pass: k?.pass ?? 0, fontBlocked: k?.['font-blocked'] ?? 0,
      ...(ok ? {} : { noVariants: 'matrix-refused' as const }), ...(column ? { column } : {}), ...(left ? { leftOutVariants: left } : {}) });
  }
  return sets;
}

/** The largest paired unit in the profile (connected pairs), by member count; its name is its code names' common prefix.
 *  A tie for largest is refused by name, never broken. */
export function largestUnit(profile: SystemProfile): { name: string; code: Set<string>; figma: Set<string> } | undefined {
  const units: Array<{ code: Set<string>; figma: Set<string> }> = [];
  for (const e of profile.pairs ?? []) {
    const hit = units.filter((u) => e.code.some((n) => u.code.has(n)) || e.figma.some((i) => u.figma.has(i)));
    const u = { code: new Set([...e.code, ...hit.flatMap((h) => [...h.code])]), figma: new Set([...e.figma, ...hit.flatMap((h) => [...h.figma])]) };
    units.splice(0, units.length, ...units.filter((x) => !hit.includes(x)), u);
  }
  const size = (u: { code: Set<string>; figma: Set<string> }) => u.code.size + u.figma.size;
  const top = [...units].sort((a, b) => size(b) - size(a))[0];
  if (!top) return undefined;
  const tied = units.filter((u) => size(u) === size(top));
  if (tied.length > 1) throw Error(`reading-largest-unit-tie:${tied.map((u) => [...u.code].sort().join('+')).sort().join(' | ')}`);
  const names = [...top.code].sort(), prefix = names.reduce((p, n) => { let i = 0; while (i < p.length && p[i] === n[i]) i++; return p.slice(0, i); });
  return { name: prefix.length >= 3 ? prefix : names[0]!, ...top };
}

/** System coverage (reviewer, 2026-11-10): in-grammar over the whole system, from its full grammar reading, so a run that
 *  holds a subset never passes the subset's coverage off as the system's. Either the reader's grammar-only output
 *  (excluded titles counted in the denominator) or a Figma classification `{ sets: [{ name, grammar }] }` (internal
 *  sets in no number). */
export function systemCoverage(file: any, profile?: SystemProfile): string {
  if (Array.isArray(file?.components)) {
    const inG = file.components.filter((c: any) => c.grammar?.grammar === 'in').length, n = file.components.length, ex = (file.excluded ?? []).length;
    return `${inG}/${n + ex}${ex ? ` with ${ex} title(s) excluded by profile counted (${inG}/${n} without)` : ''}`;
  }
  if (!Array.isArray(file?.sets)) throw Error('reading-coverage-unreadable');
  const pub = file.sets.filter((s: any) => !figmaInternal(s.name ?? s.set, profile?.figmaInternal));
  if (pub.some((s: any) => s.grammar !== 'in' && s.grammar !== 'out')) throw Error('reading-coverage-unreadable:grammar');
  return `${pub.filter((s: any) => s.grammar === 'in').length}/${pub.length}${pub.length < file.sets.length ? ` (${file.sets.length - pub.length} internal set(s) in no number)` : ''}`;
}

/** The reading, and the sensitivity reading when the sets hold members of the largest paired unit. The scorer's coverage
 *  is this run's subset; system coverage comes from `coverage` (the system's full grammar reading), or is said missing. */
export function report(sets: SetResult[], profile?: SystemProfile, coverage?: unknown): string[] {
  const system = coverage === undefined ? 'system coverage: not given' : `system coverage ${systemCoverage(coverage, profile)}`;
  const label = (line: string) => `${line.replace(' coverage ', ' subset coverage ')}; ${system}`;
  const out = [label(reading(sets).firstLine)], unit = profile && largestUnit(profile);
  const inUnit = (s: SetResult) => !!unit && (unit.code.has(s.set) || unit.figma.has(s.set.split(' ')[0]!));
  if (unit && sets.some(inUnit)) out.push(`sensitivity: without the ${unit.name} unit: ${label(reading(sets.filter((s) => !inUnit(s))).firstLine)}`);
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flag = (n: string) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  const profile = flag('--profile') ? readProfile(flag('--profile')!) : undefined, f2r = flag('--f2r'), r2f = flag('--r2f');
  if (!f2r === !r2f || (r2f && !flag('--checks'))) { console.error('usage: npx tsx scripts/reading.ts (--f2r <cells.json> | --r2f <stories.json> --checks <checks.json>) [--profile <profile.json>] [--coverage <the system\'s full grammar reading>]'); process.exit(2); }
  const base = path.dirname(path.resolve(f2r ?? flag('--checks')!)), at = (p: string) => path.resolve(base, p);
  const sets = f2r ? f2rSets((json(f2r) as Cell[]).map((c) => ({ ...c, dump: at(c.dump), grammar: at(c.grammar), ...(c.check ? { check: at(c.check) } : {}) })), profile)
    : r2fSets(json(r2f!), Object.fromEntries(Object.entries<any>(json(flag('--checks')!)).map(([t, v]) => [t, v.check ? { ...v, check: at(v.check) } : v])));
  for (const line of report(sets, profile, flag('--coverage') ? json(flag('--coverage')!) : undefined)) console.log(line);
  console.log(JSON.stringify(reading(sets), null, 2));
}
