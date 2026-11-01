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

/** One story of a component, as the Storybook reader loads it. `ownRender`: the
 *  story (or its file) supplies its own render, such as a grid of every value. */
export interface StoryInput { id: string; args: Record<string, unknown>; argTypes: Record<string, StoryArgType>; ownRender: boolean;
  /** The reader could not render the story: an instrument fault, never a grammar reason. */
  renderFailed?: boolean }
/** One expected variant as Storybook draws it: its story, with every listed option argument set to the variant's value. */
export interface VariantRender { storyId: string; args: Record<string, unknown> }
/** Named, never counted: own-render stories, repeats of an earlier story's state, and stories the reader could not render.
 *  `renders` lines up with the matrix's variants (empty when refused). */
export type StoryMatrixResult = MatrixResult & { ownRender: string[]; repeats: string[]; renderFailed: string[]; renders: VariantRender[] };

const stable = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(stable).join(',')}]`
    : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
    : JSON.stringify(v) ?? 'undefined';
const isPlain = (v: unknown) => v === undefined || ['string', 'number', 'boolean'].includes(typeof v);
const shown = (v: unknown) => (v === undefined ? '(default)' : String(v));

/** Variants shown as separate stories (owner, 2026-11-01, signed entry in GOAL.md):
 *  each story is one variant. Arguments whose plain values differ across the
 *  stories become axes with the values the stories use; option-list arguments
 *  still span their whole list inside each story (that story's own list; every
 *  story must list the same arguments, or the component is refused by name),
 *  and nothing else is combined.
 *  A story with its own render is not a variant and is named. Stories with
 *  identical arguments show one state: the first in index order counts and the
 *  others are named as repeats (a wrapper is a theme or mode, not a variant).
 *  A story the reader could not render is named apart. The cap stays 64. */
export function storyVariantMatrix(stories: readonly StoryInput[]): StoryMatrixResult {
  const renderFailed = stories.filter((s) => s.renderFailed).map((s) => s.id).sort();
  const ownRender = stories.filter((s) => !s.renderFailed && s.ownRender).map((s) => s.id).sort();
  const seen = new Set<string>(), repeats: string[] = [], drawn: StoryInput[] = [];
  for (const s of stories) {
    if (s.renderFailed || s.ownRender) continue;
    const key = stable(s.args);
    if (seen.has(key)) repeats.push(s.id); else { seen.add(key); drawn.push(s); }
  }
  repeats.sort();
  const named = { ownRender, repeats, renderFailed, renders: [] as VariantRender[] };
  if (!drawn.length) return { status: 'refused', reason: 'variant-matrix-no-story-variants', count: 0, ...named };
  // Each story's own option lists: a story may narrow an argument's list to the values it shows.
  const lists: VariantMatrix[] = [];
  for (const s of drawn) { const l = variantMatrix(s.argTypes); if (l.status === 'refused') return { ...l, ...named }; lists.push(l.matrix); }
  const listedNames = lists[0]!.axes.map((a) => a.name);
  if (lists.some((l) => stable(l.axes.map((a) => a.name)) !== stable(listedNames)))
    return { status: 'refused', reason: 'variant-matrix-option-axes-differ', count: 0, ...named };
  const names = [...new Set(drawn.flatMap((s) => Object.keys(s.args)))].filter((n) => !listedNames.includes(n)
    && drawn.every((s) => isPlain(s.args[n])) && new Set(drawn.map((s) => shown(s.args[n]))).size > 1).sort();
  // A variant is drawn from the first story that shows it, with its listed options set to the variant's values.
  const variants: Array<Record<string, string>> = [], renders: VariantRender[] = [], shownOnce = new Set<string>();
  drawn.forEach((s, i) => {
    const t = Object.fromEntries(names.map((n) => [n, shown(s.args[n])]));
    for (const v of lists[i]!.variants) {
      if (shownOnce.has(stable({ ...t, ...v }))) continue;
      shownOnce.add(stable({ ...t, ...v })); variants.push({ ...t, ...v });
      renders.push({ storyId: s.id, args: Object.fromEntries(Object.entries(v).map(([n, o]) => [n, optionsOf(s.argTypes[n]!)!.find((x) => String(x) === o)])) });
    }
  });
  const count = variants.length;
  if (count > VARIANT_CAP) return { status: 'refused', reason: `variant-matrix-over-cap:${count}>${VARIANT_CAP}`, count, ...named };
  const axes = [...listedNames.map((name) => ({ name, options: [...new Set(lists.flatMap((l) => l.axes.find((a) => a.name === name)!.options))] })),
    ...names.map((name) => ({ name, options: [...new Set(drawn.map((s) => shown(s.args[name])))] }))].sort((a, b) => a.name.localeCompare(b.name));
  return { status: 'ok', matrix: { axes, variants }, ...named, renders };
}

/** A rendered story, compacted by the Storybook reader from React's tree: `i`
 *  marks an instance of the story's component (by React component type), `h` a
 *  DOM element or text; other React nodes are flattened into their parent. */
export interface RenderedNode { i?: true; h?: true; c?: RenderedNode[] }

/** Own render, decided from the rendered page (owner condition, 2026-11-01): a
 *  story is one variant only when its root renders exactly one instance of the
 *  component and nothing beside it. Elements that contain the instance
 *  (decorators, theme providers) are allowed; any other element or text is
 *  content beside it. A component nested inside the instance is its own content. */
export function rendersOneInstance(root: RenderedNode): boolean {
  let instances = 0, beside = 0;
  const holdsInstance = (n: RenderedNode): boolean => {
    if (n.i) { instances++; return true; }
    const holds = (n.c ?? []).map(holdsInstance).some(Boolean);
    if (n.h && !holds) beside++;
    return holds;
  };
  holdsInstance(root);
  return instances === 1 && beside === 0;
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
