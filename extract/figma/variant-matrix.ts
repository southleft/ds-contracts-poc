/*  THE VARIANT MATRIX RULE (docs/GOAL.md "How numbers are counted").
 *
 *  React to Figma counts only a real component set: its variant properties are
 *  the story's enumerated arguments and its variants are their cartesian
 *  product, capped at 64 per set. Option-list arguments are the axes; true/false
 *  and text arguments become boolean and text properties, never axes. A product
 *  over the cap, or an axis with a repeated option, is refused by name rather
 *  than cut to an arbitrary subset. matchesMatrix holds a set read back from
 *  Figma against the matrix: no axis, option or variant may be missing or extra.
 *  Deterministic; frozen with the checker on 2026-11-20 (AGENTS.md rule 6).
 */
import { OPTION_CONTROLS, type StoryArgType } from './grammar.js';
import type { DumpSet } from './types.js';

export const VARIANT_CAP = 64;

export interface VariantMatrix {
  /** Sorted by name; options in the story's own order. */
  axes: Array<{ name: string; options: string[] }>;
  variants: Array<Record<string, string>>;
}
export type MatrixResult = { status: 'ok'; matrix: VariantMatrix } | { status: 'refused'; reason: string; count: number };

function optionsOf(a: StoryArgType): unknown[] | undefined {
  const type = typeof a.type === 'string' ? { name: a.type } : (a.type ?? {});
  if (type.name === 'function') return undefined;
  const options = a.options ?? (type.name === 'enum' && Array.isArray(type.value) ? type.value : undefined);
  const control = typeof a.control === 'string' ? a.control : a.control ? a.control.type : undefined;
  return options?.length && (control === undefined || OPTION_CONTROLS.has(control)) ? options : undefined;
}

export function variantMatrix(argTypes: Record<string, StoryArgType>): MatrixResult {
  const axes = Object.entries(argTypes)
    .flatMap(([name, a]) => { const options = optionsOf(a); return options ? [{ name, options: options.map(String) }] : []; })
    .sort((a, b) => a.name.localeCompare(b.name));
  const count = axes.reduce((n, axis) => n * axis.options.length, 1);
  const repeated = axes.find((axis) => new Set(axis.options).size !== axis.options.length);
  if (repeated) return { status: 'refused', reason: `variant-matrix-repeated-option:${repeated.name}`, count };
  if (count > VARIANT_CAP) return { status: 'refused', reason: `variant-matrix-over-cap:${count}>${VARIANT_CAP}`, count };
  let variants: Array<Record<string, string>> = [{}];
  for (const axis of axes) variants = variants.flatMap((v) => axis.options.map((o) => ({ ...v, [axis.name]: o })));
  return { status: 'ok', matrix: { axes, variants } };
}

const tuple = (v: Record<string, string>, names: string[]) => names.map((n) => `${n}=${v[n] ?? ''}`).join(', ');

/** Problems, sorted; none means the set is the matrix exactly. */
export function matchesMatrix(set: DumpSet, matrix: VariantMatrix): string[] {
  const problems: string[] = [];
  const defs = Object.entries(set.propertyDefinitions ?? {}).filter(([, d]) => d.type === 'VARIANT') as Array<[string, { variantOptions: string[] }]>;
  const axisNames = matrix.axes.map((a) => a.name);
  for (const axis of matrix.axes) {
    const def = defs.find(([name]) => name === axis.name)?.[1];
    if (!def) problems.push(`axis-missing:${axis.name}`);
    else if ([...def.variantOptions].sort().join('\u0000') !== [...axis.options].sort().join('\u0000')) problems.push(`options-differ:${axis.name}`);
  }
  for (const [name] of defs) if (!axisNames.includes(name)) problems.push(`axis-extra:${name}`);
  const want = new Set(matrix.variants.map((v) => tuple(v, axisNames)));
  const seen = new Set<string>();
  for (const v of set.variants) {
    const t = tuple(v.variantProperties ?? {}, axisNames);
    if (seen.has(t)) problems.push(`variant-duplicate:${t}`);
    else if (!want.has(t)) problems.push(`variant-extra:${t}`);
    seen.add(t);
  }
  for (const t of want) if (!seen.has(t)) problems.push(`variant-missing:${t}`);
  return problems.sort();
}
