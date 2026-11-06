/**
 * THE REACT TO FIGMA CHECK, part 1: the set rule (docs/GOAL.md "How numbers are
 * counted"). React to Figma counts only a real component set. A Figma set written
 * from a library's component is held against the Storybook reader's references for
 * that component:
 *   - it is a COMPONENT_SET and every variant is a COMPONENT;
 *   - its variant properties are the story matrix exactly (matchesMatrix, capped at
 *     64 by the reader), rebuilt from each reference's value on each axis;
 *   - it uses auto layout outside drawings: none of the grammar classifier's own
 *     layout reasons (classifyDump), so a drawing is exempt exactly as there;
 *   - every text a reference draws is TEXT characters in its paired variant,
 *     normalized as the Figma to React check's missingTexts normalizes it.
 * A set that fails counts every expected variant as failed; it never leaves the
 * denominator. A reference the rule cannot read (no render, no content) leaves its
 * own variant unverified, also a failure, and the rule holds on every other one.
 * The share of visible solid paints bound to a variable, text fills included, is
 * reported and never gates. Deterministic, no model call; frozen with the checker
 * on 2026-11-20 (AGENTS.md rule 6).
 *
 * Run: npx tsx scripts/react-to-figma-check.ts --stories <stories.json> --component <title>
 *        --dump <the written set's plugin dump> --set <set name> --out <dir>
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { classifyDump } from '../extract/figma/grammar.js';
import type { DumpFile, DumpNode, DumpSet } from '../extract/figma/types.js';
import { matchesMatrix, type VariantMatrix } from '../extract/figma/variant-matrix.js';
import { missingTexts } from './design-consumer-content.js';
import type { StoryComponent, VariantReference } from './storybook-reader.js';

/** The grammar classifier's reasons that concern layout: a box with children and no auto layout that is not a
 *  drawing, a grid, a wrapping row, an absolutely placed child. */
export const LAYOUT_REASONS = ['absolute-child', 'free-form-frame', 'grid-layout', 'layout-wrap'];

export interface SetVariant { key: string; variant: Record<string, string>; verdict: 'pending' | 'fail' | 'unverified'; reasons: string[] }
export interface SetRule { counts: boolean; problems: string[]; boundColors: { solid: number; bound: number }; variants: SetVariant[] }

const keyOf = (v: Record<string, string>, axes: readonly string[]) => axes.map((a) => `${a}=${v[a] ?? ''}`).join(', ');
const shown = (n: DumpNode) => n.hidden !== true && n.opacity !== 0;

/** The matrix the reader held the component's stories against, rebuilt from its references (in its order). */
export function storyMatrix(component: StoryComponent): VariantMatrix | undefined {
  if (component.matrix.status !== 'ok') return undefined;
  const axes = component.matrix.axes.map((name) => ({ name, options: [...new Set(component.references.map((r) => r.variant[name]!))] }));
  return { axes, variants: component.references.map((r) => r.variant) };
}

/** Every TEXT's characters the variant draws. */
function characters(n: DumpNode): string[] {
  if (!shown(n)) return [];
  return [...(n.type === 'TEXT' && n.text ? [n.text.characters] : []), ...(n.children ?? []).flatMap(characters)];
}

/** Visible SOLID fills and strokes on drawn nodes, text fills included, and how many are bound to a variable. */
export function boundColors(set: DumpSet): { solid: number; bound: number } {
  let solid = 0, bound = 0;
  const visit = (n: DumpNode) => {
    if (!shown(n)) return;
    for (const stack of [n.sourceFillStack, n.sourceStrokeStack]) for (const { paint } of stack?.paints ?? []) {
      const p = paint as { type?: unknown; visible?: unknown; boundVariables?: { color?: unknown } } | null;
      if (p?.type !== 'SOLID' || p.visible === false) continue;
      solid++;
      if (p.boundVariables?.color) bound++;
    }
    for (const c of n.children ?? []) visit(c);
  };
  for (const v of set.variants) visit(v);
  return { solid, bound };
}

/** Text drawn by the reference (opacity above zero), or why it cannot be read. */
function drawnTexts(r: VariantReference): string[] | string {
  if (r.problem) return r.problem;
  if (!r.content) return r.contentProblem ?? 'reference-content-missing';
  return (r.content.runs ?? []).filter((run) => run.opacity > 0).map((run) => run.text);
}

export function setRule(component: StoryComponent, file: DumpFile, setName: string): SetRule {
  const entry = Object.entries(file).find(([, v]) => (v as DumpSet | undefined)?.setName === setName && Array.isArray((v as DumpSet).variants));
  const set = entry?.[1] as DumpSet | undefined;
  const matrix = storyMatrix(component);
  const axes = component.matrix.status === 'ok' ? component.matrix.axes : [];
  const variants: SetVariant[] = component.references.map((r) => ({ key: keyOf(r.variant, axes), variant: r.variant, verdict: 'pending', reasons: [] }));
  if (!matrix) return { counts: false, problems: [`story-matrix-refused:${(component.matrix as { reason: string }).reason}`], boundColors: { solid: 0, bound: 0 }, variants };
  const problems: string[] = [];
  if (!set) problems.push(`set-missing:${setName}`);
  else {
    if (set.type !== 'COMPONENT_SET' || set.variants.some((v) => v.type !== 'COMPONENT')) problems.push('not-a-component-set');
    problems.push(...matchesMatrix(set, matrix));
    const reasons = classifyDump({ [entry![0]]: set } as DumpFile)[entry![0]]?.reasons ?? [];
    problems.push(...reasons.filter((r) => LAYOUT_REASONS.includes(r)).map((r) => `layout:${r}`));
    const written = new Map(set.variants.map((v) => [keyOf(v.variantProperties ?? {}, axes), v]));
    component.references.forEach((r, i) => {
      const texts = drawnTexts(r), node = written.get(variants[i]!.key);
      if (typeof texts === 'string') { variants[i]!.verdict = 'unverified'; variants[i]!.reasons.push(`text-unverified:${texts}`); return; }
      if (!node) return; // named once by matchesMatrix
      for (const t of missingTexts(texts, characters(node).join('\n'))) problems.push(`text-not-editable:${variants[i]!.key}:${JSON.stringify(t)}`);
    });
  }
  const counts = problems.length === 0;
  if (!counts) for (const v of variants) if (v.verdict === 'pending') { v.verdict = 'fail'; v.reasons.push('not-a-real-component-set'); }
  return { counts, problems: problems.sort(), boundColors: set ? boundColors(set) : { solid: 0, bound: 0 }, variants };
}

if (process.argv[1]?.endsWith('react-to-figma-check.ts')) {
  const flag = (name: string) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
  const [storiesPath, title, dumpPath, setName, out] = ['--stories', '--component', '--dump', '--set', '--out'].map(flag);
  if (!storiesPath || !title || !dumpPath || !setName || !out) {
    console.error('usage: npx tsx scripts/react-to-figma-check.ts --stories <stories.json> --component <title> --dump <dump.json> --set <name> --out <dir>');
    process.exit(2);
  }
  const [storiesBytes, dumpBytes] = [readFileSync(storiesPath), readFileSync(dumpPath)];
  const component = (JSON.parse(storiesBytes.toString()) as { components: StoryComponent[] }).components.find((c) => c.title === title);
  if (!component) { console.error(`✖ no component titled ${JSON.stringify(title)} in ${storiesPath}`); process.exit(2); }
  const rule = setRule(component, JSON.parse(dumpBytes.toString()) as DumpFile, setName);
  const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'react-to-figma.json'), JSON.stringify({ version: 1, component: title, set: setName,
    inputs: { stories: sha(storiesBytes), dump: sha(dumpBytes) }, ...rule }, null, 2) + '\n');
  const { solid, bound } = rule.boundColors;
  console.log(`${title} → ${setName}: ${rule.counts ? 'a real component set' : `not counted (${rule.problems.length} problem(s))`}; ` +
    `${rule.variants.length} expected variant(s); colors bound to variables ${bound} of ${solid}`);
  for (const p of rule.problems) console.log(`  ${p}`);
  process.exit(rule.counts ? 0 : 1);
}
