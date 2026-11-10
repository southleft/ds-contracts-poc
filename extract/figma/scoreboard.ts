/*  THE SCOREBOARD ("How numbers are counted", docs/GOAL.md), from per-set results.
 *
 *  Four numbers per direction, always together: coverage (in-grammar sets as a share of the kit), in-grammar first
 *  pass (the headline: the mean of per-set pass rates, every set weighted equally), raw first pass (every variant,
 *  refusals counted as failures) and font-blocked variants. Whole sets passing and the in-grammar per-variant rate sit
 *  beside the headline. Icon-only, glyph-only and skeleton-only sets are their own columns (2026-11-10): outside the
 *  headline and raw first pass, still in coverage. A font-blocked variant is never a pass and never a failure
 *  (AGENTS.md rule 9): it leaves both sides of every rate and is its own number, and a set whose every variant is
 *  font-blocked has no rate and is named. Deterministic; no model call. Frozen with the checker on 2026-11-20.
 *
 *  Run: npx tsx extract/figma/scoreboard.ts <sets.json>  (a JSON list of SetResult; the reading on stdout)
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { DumpNode, DumpSet } from './types.js';

export const COLUMNS = ['icon-only', 'glyph-only', 'skeleton-only'] as const;
export type Column = typeof COLUMNS[number];
/** `variants` is every variant the set is expected to have: a set whose conversion failed (a script error, a build
 *  refusal) keeps them and passes none, so it is in the headline at 0. `noVariants` is the receipt's reason a set has
 *  none to score, never guessed: its matrix was refused before conversion. It then has no rate and is named. */
export interface SetResult { set: string; grammar: 'in' | 'out'; variants: number; pass: number; fontBlocked: number; column?: Column; noVariants?: 'matrix-refused' }
/** `rated`: the sets with a rate, the ones the headline is the mean over; `noRate`: every other set, by name and why. */
export interface Numbers { sets: number; rated: number; headline: number | null; pass: number; of: number; whole: number; fontBlocked: number;
  noRate: Array<{ set: string; why: 'font-blocked' | 'matrix-refused' }> }
export interface Reading {
  firstLine: string; coverage: { inGrammar: number; sets: number };
  /** In-grammar sets outside every column; `pass` / `of` is the in-grammar per-variant rate. */
  headline: Numbers;
  /** Every variant of every set outside the columns; an out-of-grammar set's refusals are failures. */
  rawFirstPass: { pass: number; of: number };
  fontBlocked: { total: number; perSet: Record<string, number> };
  /** Each column's in-grammar sets, read like the headline. */
  columns: Record<Column, Numbers>;
}

const counted = (s: SetResult) => s.variants - s.fontBlocked;
function valid(s: SetResult): void {
  // A set has one variant or more unless the receipt says why it has none: an unknown count would leave it out of every
  // rate without a trace, and a failed conversion must count at 0.
  const whole = [s.variants, s.pass, s.fontBlocked].every((n) => Number.isInteger(n) && n >= 0);
  if (!whole || (s.variants < 1) !== (s.noVariants === 'matrix-refused') || (s.noVariants !== undefined && s.noVariants !== 'matrix-refused') || s.pass > counted(s) || !['in', 'out'].includes(s.grammar) || (s.column !== undefined && !COLUMNS.includes(s.column)))
    throw Error(`scoreboard-input-invalid:${s.set}`);
}

/** Every set in `sets` counted: a set's rate is its passes over its variants less the font-blocked ones. */
export function numbers(sets: readonly SetResult[]): Numbers {
  sets.forEach(valid);
  const rated = sets.filter((s) => counted(s) > 0), rates = rated.map((s) => s.pass / counted(s));
  return { sets: sets.length, rated: rated.length, headline: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
    pass: sets.reduce((n, s) => n + s.pass, 0), of: sets.reduce((n, s) => n + counted(s), 0),
    whole: rated.filter((s) => s.pass === counted(s)).length, fontBlocked: sets.reduce((n, s) => n + s.fontBlocked, 0),
    noRate: sets.filter((s) => !counted(s)).map((s) => ({ set: s.set, why: s.noVariants ?? 'font-blocked' as const })).sort((a, b) => a.set.localeCompare(b.set)) };
}

const pct = (x: number | null) => (x === null ? 'none' : `${(100 * x).toFixed(1)}%`);
/** One direction's reading. */
export function reading(sets: readonly SetResult[]): Reading {
  const main = sets.filter((s) => !s.column), headline = numbers(main.filter((s) => s.grammar === 'in')), raw = numbers(main);
  const all = numbers(sets), inGrammar = sets.filter((s) => s.grammar === 'in').length;
  const columns = Object.fromEntries(COLUMNS.map((c) => [c, numbers(sets.filter((s) => s.column === c && s.grammar === 'in'))])) as Record<Column, Numbers>;
  const blocked = all.fontBlocked ? `${all.fontBlocked} font-blocked variant(s), in no rate; ` : '';
  const none = headline.noRate.length ? `; no rate for ${headline.noRate.map((n) => `${n.set} (${n.why})`).join(', ')}` : '';
  const firstLine = `${blocked}headline ${pct(headline.headline)} over ${headline.rated} in-grammar set(s), coverage ${inGrammar}/${sets.length}, `
    + `raw first pass ${raw.pass}/${raw.of}, whole sets ${headline.whole}/${headline.rated}, font-blocked ${all.fontBlocked}${none}`;
  return { firstLine, coverage: { inGrammar, sets: sets.length }, headline, rawFirstPass: { pass: raw.pass, of: raw.of },
    fontBlocked: { total: all.fontBlocked, perSet: Object.fromEntries(sets.filter((s) => s.fontBlocked).map((s) => [s.set, s.fontBlocked])) }, columns };
}

/** What one variant draws, as both sides report it: its text runs, its graphics (vector or SVG, or not) and how many
 *  boxes it paints (a fill, border or shadow on any element outside a vector, its root included). */
export interface VariantDrawing { runs: string[]; graphics: Array<'vector' | 'other'>; painted: number }
/** Strict, so narrow: anything not clearly an icon or a glyph stays in the headline (reviewer ruling, 2026-11-10).
 *  Icon-only: every variant draws no text and one or more graphics, all vector or SVG, and paints no box.
 *  Glyph-only: every variant draws exactly one text run of one or two characters, no graphic and no painted box. */
export function drawnColumn(variants: ReadonlyArray<VariantDrawing | null>): Column | undefined {
  if (!variants.length || variants.some((v) => !v)) return undefined;
  const v = variants as VariantDrawing[];
  if (v.every((d) => !d.runs.length && d.graphics.length && d.graphics.every((g) => g === 'vector') && !d.painted)) return 'icon-only';
  if (v.every((d) => d.runs.length === 1 && [...d.runs[0]!].length <= 2 && !d.graphics.length && !d.painted)) return 'glyph-only';
  return undefined;
}

const VECTORS = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'STAR', 'POLYGON', 'REGULAR_POLYGON', 'LINE']);
/** The Figma side, from a dump variant: TEXT nodes, vector nodes and painted boxes (a frame, rectangle, group or
 *  instance with a fill, stroke or shadow). An image paint is a graphic that is not a vector. Hidden nodes draw nothing. */
export function dumpDrawing(root: DumpNode): VariantDrawing {
  const d: VariantDrawing = { runs: [], graphics: [], painted: 0 };
  const walk = (n: DumpNode) => {
    if (n.hidden || n.opacity === 0) return;
    if (n.type === 'TEXT') { const t = (n.text?.characters ?? '').trim(); if (t) d.runs.push(t); return; }
    const image = !!(n.imagePaints?.length || n.imageFill), paints = !!(n.fill || n.gradient || (n.stroke && (n.strokeWeight ?? 1) > 0)
      || n.effects?.some((e) => /SHADOW/.test(e.type) && (e as { visible?: boolean }).visible !== false));
    if (VECTORS.has(n.type)) { if (paints || image) d.graphics.push(image ? 'other' : 'vector'); return; }
    if (image) d.graphics.push('other'); else if (paints) d.painted++;
    for (const c of n.children ?? []) walk(c);
  };
  walk(root);
  return d;
}
/** The code side, from a reader reference: its text runs, its graphics (an `svg` is a vector) and its painted boxes. */
export const domDrawing = (c: { text: string; runs?: Array<{ text: string }>; graphics: Array<{ tag: string }> }, painted: number): VariantDrawing =>
  ({ runs: (c.runs ? c.runs.map((r) => r.text) : c.text.split('\n')).map((t) => t.trim()).filter(Boolean), graphics: c.graphics.map((g) => (g.tag === 'svg' ? 'vector' : 'other')), painted });

/** A profile's Figma skeleton data (entry of 2026-11-10): the variant value that marks a skeleton, and sets drawn as
 *  skeletons by the kit. A set is skeleton-only when every variant carries the value, or when the profile lists it. */
export interface FigmaSkeleton { variant?: { property: string; value: string }; sets?: string[] }
export function figmaSkeletonOnly(set: DumpSet, data: FigmaSkeleton | undefined): boolean {
  if (!data) return false;
  if (set.nodeId !== undefined && data.sets?.includes(set.nodeId)) return true;
  const v = data.variant;
  return !!v && set.variants.length > 0 && set.variants.every((x) => x.variantProperties?.[v.property] === v.value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = reading(JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as SetResult[]);
  console.log(r.firstLine); console.log(JSON.stringify(r, null, 2));
}
