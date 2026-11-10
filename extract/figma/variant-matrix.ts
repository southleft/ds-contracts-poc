/*  THE VARIANT MATRIX RULE (docs/GOAL.md "How numbers are counted").
 *
 *  React to Figma counts only a real component set: its variant properties are
 *  the story's enumerated arguments and its variants are their cartesian
 *  product, capped at 128 per set (grammar decision 3). Option-list arguments are the axes; true/false
 *  and text arguments become boolean and text properties, never axes. A product
 *  over the cap, or an axis with a repeated option, is refused by name rather
 *  than cut to an arbitrary subset. matchesMatrix holds a set read back from
 *  Figma against the matrix: no axis, option or variant may be missing or extra.
 *  Deterministic; frozen with the checker on 2026-11-20 (AGENTS.md rule 6).
 */
import { OPTION_CONTROLS, type StoryArgType } from './grammar.js';
import type { DumpSet } from './types.js';

export const VARIANT_CAP = 128;

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

/** One story of a component, as the Storybook reader loads it. `ownRender`: the story draws no instance of its own
 *  component (grammar decision 5), so it is refused by name. `instances`: when it draws two or more, each instance's own
 *  props read from React's tree (plain values; the names of any others), one per instance, in drawing order. */
export interface StoryInput { id: string; args: Record<string, unknown>; argTypes: Record<string, StoryArgType>; ownRender: boolean;
  /** The reader could not render the story: an instrument fault, never a grammar reason. */
  renderFailed?: boolean; instances?: Array<{ props: Record<string, string | number | boolean>; nonPlain: string[] }> }
/** One expected variant as Storybook draws it: its story, with every listed option argument set to the variant's value;
 *  `instance` picks the instance a story drawing several shows it with (grammar decision 5). */
export interface VariantRender { storyId: string; args: Record<string, unknown>; instance?: number }
/** Named, never counted: stories that draw no instance of their own component, repeats of an earlier story's state,
 *  stories the reader could not render, and stories with an instance whose axis value is not a plain value.
 *  `renders` lines up with the matrix's variants (empty when refused). */
export type StoryMatrixResult = MatrixResult & { ownRender: string[]; repeats: string[]; renderFailed: string[]; instanceUnreadable: string[]; renders: VariantRender[] };

/** Grammar decision 5: a story drawing several instances gives one variant per instance, named by its own value on each
 *  axis (an unset prop is the default), never by guessing from the page; a non-plain value can't name one (null). */
const instanceVariants = (s: StoryInput, axes: readonly string[]): Array<Record<string, string>> | null => {
  const out: Array<Record<string, string>> = [];
  for (const i of s.instances!) { if (axes.some((n) => i.nonPlain.includes(n))) return null; out.push(Object.fromEntries(axes.map((n) => [n, valueOf(s, n, i.props[n])]))); }
  return out;
};
const showcase = (s: StoryInput) => (s.instances?.length ?? 0) > 1;

const stable = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(stable).join(',')}]`
    : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
    : JSON.stringify(v) ?? 'undefined';
const isPlain = (v: unknown) => v === undefined || ['string', 'number', 'boolean'].includes(typeof v);
const shown = (v: unknown) => (v === undefined ? '(default)' : String(v));
/** An unset axis reads the default the stories file documents for it (a quoted string, a boolean or a number, as
 *  `table.defaultValue` writes it); with none documented it stays `(default)`, never guessed. */
const valueOf = (s: StoryInput, n: string, v: unknown) => {
  const d = v === undefined ? /^(?:'(.*)'|"(.*)"|(true|false|-?\d+(?:\.\d+)?))$/.exec(s.argTypes[n]?.defaultValue ?? '') : null;
  return d ? d[1] ?? d[2] ?? d[3]! : shown(v);
};

/** Variants shown as separate stories (owner, 2026-11-01, signed entry in GOAL.md):
 *  each story is one variant. Arguments whose plain values differ across the
 *  stories become axes with the values the stories use; option-list arguments
 *  still span their whole list inside each story (that story's own list; every
 *  story must list the same arguments, or the component is refused by name),
 *  and nothing else is combined.
 *  A story with its own render is not a variant and is named. Stories with
 *  identical arguments show one state: the first in index order counts and the
 *  others are named as repeats (a wrapper is a theme or mode, not a variant).
 *  A story the reader could not render is named apart. The cap is 128 (grammar decision 3).
 *  `declared`, a system profile's declaration (grammar decision 4), names the component's real axes: see declaredMatrix. */
export function storyVariantMatrix(stories: readonly StoryInput[], declared?: readonly string[]): StoryMatrixResult {
  const renderFailed = stories.filter((s) => s.renderFailed).map((s) => s.id).sort();
  const ownRender = stories.filter((s) => !s.renderFailed && s.ownRender).map((s) => s.id).sort();
  const seen = new Set<string>(), repeats: string[] = [], drawn: StoryInput[] = [];
  for (const s of stories) {
    if (s.renderFailed || s.ownRender) continue;
    // Grammar decision 5: a story drawing several instances is a repeat only when its instances add no variant.
    if (showcase(s)) { drawn.push(s); continue; }
    const key = stable(s.args);
    if (seen.has(key)) repeats.push(s.id); else { seen.add(key); drawn.push(s); }
  }
  repeats.sort();
  const named = { ownRender, repeats, renderFailed, instanceUnreadable: [] as string[], renders: [] as VariantRender[] };
  if (!drawn.length) return { status: 'refused', reason: 'variant-matrix-no-story-variants', count: 0, ...named };
  if (declared) return { ...named, ...declaredMatrix(drawn, declared, repeats, named.instanceUnreadable) };
  // Each story's own option lists: a story may narrow an argument's list to the values it shows.
  const lists: VariantMatrix[] = [];
  for (const s of drawn) { const l = variantMatrix(s.argTypes); if (l.status === 'refused') return { ...l, ...named }; lists.push(l.matrix); }
  const listedNames = lists[0]!.axes.map((a) => a.name);
  if (lists.some((l) => stable(l.axes.map((a) => a.name)) !== stable(listedNames)))
    return { status: 'refused', reason: 'variant-matrix-option-axes-differ', count: 0, ...named };
  const names = [...new Set(drawn.flatMap((s) => Object.keys(s.args)))].filter((n) => !listedNames.includes(n)
    && drawn.every((s) => isPlain(s.args[n])) && new Set(drawn.map((s) => valueOf(s, n, s.args[n]))).size > 1).sort();
  // A variant is drawn from the first story that shows it, with its listed options set to the variant's values.
  const variants: Array<Record<string, string>> = [], renders: VariantRender[] = [], shownOnce = new Set<string>();
  drawn.forEach((s, i) => {
    const t = Object.fromEntries(names.map((n) => [n, valueOf(s, n, s.args[n])])), before = variants.length;
    if (showcase(s)) {
      const own = instanceVariants(s, [...listedNames, ...names]);
      if (!own) { named.instanceUnreadable.push(s.id); return; }
      own.forEach((v, k) => { if (shownOnce.has(stable(v))) return; shownOnce.add(stable(v)); variants.push(v); renders.push({ storyId: s.id, args: {}, instance: k }); });
    } else for (const v of lists[i]!.variants) {
      if (shownOnce.has(stable({ ...t, ...v }))) continue;
      shownOnce.add(stable({ ...t, ...v })); variants.push({ ...t, ...v });
      renders.push({ storyId: s.id, args: Object.fromEntries(Object.entries(v).map(([n, o]) => [n, optionsOf(s.argTypes[n]!)!.find((x) => String(x) === o)])) });
    }
    // A story whose differences are all non-plain (an object, an element) adds no variant: named, never dropped silently.
    if (variants.length === before) repeats.push(s.id);
  });
  repeats.sort();
  const count = variants.length;
  if (count > VARIANT_CAP) return { status: 'refused', reason: `variant-matrix-over-cap:${count}>${VARIANT_CAP}`, count, ...named };
  // An axis's options: its listed values, then every value a variant shows (an instance's own, too), in order.
  const axes = [...listedNames.map((name) => ({ name, options: [...new Set([...lists.flatMap((l) => l.axes.find((a) => a.name === name)!.options), ...variants.map((v) => v[name]!)])] })),
    ...names.map((name) => ({ name, options: [...new Set(variants.map((v) => v[name]!))] }))].sort((a, b) => a.name.localeCompare(b.name));
  return { status: 'ok', matrix: { axes, variants }, ...named, renders };
}

/** Grammar decision 4 (2026-11-09): the declared axes are the component's variant axes. Each story spans its own
 *  option list on a declared axis it lists; on a declared axis it does not list, it keeps its own value. Anything
 *  undeclared stays at the story's value and makes no variant (a playground control), so two stories that differ only
 *  there show one variant, the first. A declared axis must be one the stories have (an option list, or a value a
 *  story sets); otherwise the component is refused by name. Nothing adds a value no story renders. */
function declaredMatrix(drawn: StoryInput[], axes: readonly string[], repeats: readonly string[], unreadable: string[]): MatrixResult & { renders: VariantRender[]; repeats: string[] } {
  const listed = drawn.map((s) => new Map(axes.flatMap((n) => (s.argTypes[n] && optionsOf(s.argTypes[n]!) ? [[n, optionsOf(s.argTypes[n]!)!]] : []))));
  const unknown = axes.find((n) => !listed.some((l) => l.has(n)) && !drawn.some((s) => n in s.args || s.instances?.some((i) => n in i.props)));
  if (unknown !== undefined) return { status: 'refused', reason: `declaration-axis-unknown:${unknown}`, count: 0, renders: [], repeats: [...repeats] };
  // A story that adds no variant (every one of its declared values is already shown) is named as a repeat, so a
  // difference only in undeclared values (a badge, say) is never dropped without a trace.
  const variants: Array<Record<string, string>> = [], renders: VariantRender[] = [], seen = new Set<string>(), added: string[] = [...repeats];
  drawn.forEach((s, i) => {
    let own: Array<Record<string, string>> | null = [{}];
    if (showcase(s)) own = instanceVariants(s, axes);
    else for (const n of axes) own = own!.flatMap((v) => (listed[i]!.get(n) ?? [s.args[n]]).map((o) => ({ ...v, [n]: valueOf(s, n, o) })));
    if (!own) { unreadable.push(s.id); return; }
    const before = variants.length;
    own.forEach((v, k) => {
      if (seen.has(stable(v))) return;
      seen.add(stable(v)); variants.push(v);
      renders.push(showcase(s) ? { storyId: s.id, args: {}, instance: k }
        : { storyId: s.id, args: Object.fromEntries([...listed[i]!].map(([n, o]) => [n, o.find((x) => String(x) === v[n])])) });
    });
    if (variants.length === before) added.push(s.id);
  });
  added.sort();
  if (variants.length > VARIANT_CAP) return { status: 'refused', reason: `variant-matrix-over-cap:${variants.length}>${VARIANT_CAP}`, count: variants.length, renders: [], repeats: added };
  return { status: 'ok', matrix: { axes: [...axes].sort().map((name) => ({ name, options: [...new Set(variants.map((v) => v[name]!))] })), variants }, renders, repeats: added };
}

/** A rendered story, compacted by the Storybook reader from React's tree: `i`
 *  marks an instance of the story's component (by React component type), `h` a
 *  DOM element or text; other React nodes are flattened into their parent. */
export interface RenderedNode { i?: true; h?: true; c?: RenderedNode[] }


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
