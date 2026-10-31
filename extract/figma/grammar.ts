/*  THE GRAMMAR CLASSIFIER (ACG-1, docs/GOAL.md "The grammar").
 *
 *  Marks every Figma component set in a dump, and every story's arguments, IN
 *  or OUT of the grammar with named reasons, before any conversion runs. It
 *  reads only facts the dump already carries (layout, placement, paint and
 *  stroke stacks, effects, property definitions) and the reader's own named
 *  degradations for channels older dumps did not capture. Deterministic: the
 *  same dump gives the same verdicts, reasons sorted. Frozen with the checker
 *  on 2026-11-20 (AGENTS.md rule 6); it only widens through a signed decision.
 *
 *  Run: npx tsx extract/figma/grammar.ts <dump.json>…  (JSON verdicts on stdout)
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import type { DumpFile, DumpNode, DumpSet } from './types.js';

export interface GrammarVerdict {
  grammar: 'in' | 'out';
  reasons: string[];
}

const SHAPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'LINE', 'ELLIPSE', 'RECTANGLE', 'STAR', 'POLYGON', 'REGULAR_POLYGON']);
const BOXES = new Set(['FRAME', 'COMPONENT', 'GROUP']);

/** A drawing: a subtree with no text and no auto layout (icons, vectors, decor
 *  boxes). It is carried as SVG, so placement inside it is free. */
const drawing = (n: DumpNode): boolean => n.type !== 'TEXT' && n.type !== 'SLOT' && !n.layout && (n.children ?? []).every(drawing);

const visiblePaints = (stack: DumpNode['sourceFillStack']): string[] =>
  (stack?.paints ?? []).map((p) => (p.paint ?? {}) as { type?: unknown; visible?: unknown }).filter((p) => p.visible !== false).map((p) => String(p.type));
const paintReason = (type: string): string | undefined =>
  type === 'SOLID' ? undefined : type === 'IMAGE' ? 'image-fill' : type.startsWith('GRADIENT') ? 'gradient-fill' : 'non-solid-paint';

/** Reasons from one node's own facts; `parent` is undefined at a variant root. */
function nodeReasons(n: DumpNode, parent: DumpNode | undefined, out: Set<string>): void {
  if (n.type === 'SLOT') out.add('slot-property');
  if (n.layout?.mode === 'GRID') out.add('grid-layout');
  if (n.layout?.wrap) out.add('layout-wrap');
  if (n.abs && parent?.layout) out.add('absolute-child');
  const kids = n.children ?? [];
  if (BOXES.has(n.type) && !n.layout && kids.length && !drawing(n)) out.add('free-form-frame');
  if (n.mask) out.add('mask');
  if (n.imagePaints?.length || n.imageFill) out.add('image-fill');
  if (n.gradient) out.add('gradient-fill');
  for (const [stack, many] of [[n.sourceFillStack, 'multiple-fills'], [n.sourceStrokeStack, 'multiple-strokes']] as const) {
    const paints = visiblePaints(stack);
    if (paints.length > 1) out.add(many);
    for (const t of paints) if (paintReason(t)) out.add(paintReason(t)!);
  }
  if (n.sourceStrokePattern?.dashes.length || n.rectStrokePattern?.dashes.length) out.add('dashed-stroke');
  for (const e of n.effects ?? []) if (e.type !== 'DROP_SHADOW') out.add(`effect-${String(e.type).toLowerCase().replace(/_/g, '-')}`);
  for (const k of kids) nodeReasons(k, n, out);
}

/** The reader's named degradations for channels a dump could not carry. */
const DEGRADED: Record<string, string> = {
  'paint-stack-truncated': 'multiple-fills',
  'paint-unsupported': 'non-solid-paint',
  'blend-mode-unsupported': 'blend-mode',
  'vector-mask-unsupported': 'mask',
  'stroke-style-unsupported': 'dashed-stroke',
  'native-line-unsupported': 'dashed-stroke',
  'rotation-unsupported': 'rotation',
  'grid-implicit-tracks-lossy': 'grid-layout',
  'grid-track-unparsed': 'grid-layout',
};
const ROTATED_SHAPE = new RegExp(`on an? (${[...SHAPES].join('|')})\\b`);
function degradationReason(code: string, message: string): string | undefined {
  if (code === 'text-channel-unsupported') return /mixed|character ranges/.test(message) ? 'mixed-text-style' : undefined;
  // A rotated vector is part of an SVG drawing; only a rotated box or text is outside the grammar.
  if (code === 'rotation-unsupported' && ROTATED_SHAPE.test(message)) return undefined;
  return DEGRADED[code];
}

/** Every set in the dump, keyed by its dump key. A set holding an instance of an
 *  out-of-grammar set in the same dump is out too (instance swaps and nested
 *  components only to in-grammar components). */
export function classifyDump(file: DumpFile): Record<string, GrammarVerdict> {
  // Sets are told from metadata by shape, not by key: a set may be named `_Text`.
  const entries = Object.entries(file).filter(
    ([, v]) => !!v && typeof v === 'object' && Array.isArray((v as DumpSet).variants) && typeof (v as DumpSet).setName === 'string',
  ) as Array<[string, DumpSet]>;
  const own = new Map<string, Set<string>>();
  for (const [key, set] of entries) {
    const reasons = new Set<string>();
    for (const def of Object.values(set.propertyDefinitions ?? {})) if (def.type === 'SLOT') reasons.add('slot-property');
    for (const v of set.variants) nodeReasons(v, undefined, reasons);
    for (const d of file._degradations ?? []) {
      const r = d.nodePath.startsWith(`${set.setName}:`) ? degradationReason(d.code, d.message) : undefined;
      if (r) reasons.add(r);
    }
    own.set(key, reasons);
  }
  const owner = new Map<string, string>();
  for (const [key, set] of entries) {
    if (set.key) owner.set(set.key, key);
    for (const v of set.variants) if (v.componentKey) owner.set(v.componentKey, key);
  }
  const target = (k: string | undefined, self: string): string | undefined => (k && owner.get(k) !== self ? owner.get(k) : undefined);
  // Two ways to reach another set: drawing an instance of it, or offering it as an instance swap.
  const links = entries.map(([key, set]) => {
    const nested = new Set<string>();
    const walk = (n: DumpNode): void => {
      for (const k of [n.instanceSetKey, n.instanceKey]) if (target(k, key)) nested.add(target(k, key)!);
      (n.children ?? []).forEach(walk);
    };
    set.variants.forEach(walk);
    const swaps = new Set<string>();
    for (const def of Object.values(set.propertyDefinitions ?? {}))
      if (def.type === 'INSTANCE_SWAP') for (const v of def.preferredValues ?? []) if (target(v.key, key)) swaps.add(target(v.key, key)!);
    return [key, [[nested, 'nested-component-out-of-grammar'], [swaps, 'instance-swap-out-of-grammar']]] as const;
  });
  for (let changed = true; changed; ) {
    changed = false;
    for (const [key, relations] of links) {
      const reasons = own.get(key)!;
      for (const [sets, reason] of relations) {
        if (!reasons.has(reason) && [...sets].some((u) => own.get(u)!.size)) {
          reasons.add(reason);
          changed = true;
        }
      }
    }
  }
  return Object.fromEntries(entries.map(([key]) => {
    const reasons = [...own.get(key)!].sort();
    return [key, { grammar: reasons.length ? 'out' : 'in', reasons }];
  }));
}

/** Storybook argTypes for one story: option lists, true/false and text are in;
 *  function arguments (actions) draw nothing and are ignored; anything else is
 *  named by its control, or by its type when it has no control. */
export interface StoryArgType {
  control?: { type?: string } | string | false;
  options?: unknown[];
  type?: { name?: string; value?: unknown } | string;
}
const OPTION_CONTROLS = new Set(['select', 'radio', 'inline-radio']);
export function classifyStoryArgs(argTypes: Record<string, StoryArgType>): GrammarVerdict {
  const reasons = new Set<string>();
  for (const a of Object.values(argTypes)) {
    const type = typeof a.type === 'string' ? { name: a.type } : (a.type ?? {});
    if (type.name === 'function') continue;
    const options = a.options ?? (type.name === 'enum' && Array.isArray(type.value) ? type.value : []);
    const control = typeof a.control === 'string' ? a.control : a.control ? a.control.type : undefined;
    const kind = control ?? (options.length ? 'select' : type.name === 'boolean' ? 'boolean' : type.name === 'string' ? 'text' : (type.name ?? 'unknown'));
    if (OPTION_CONTROLS.has(kind)) {
      if (!options.length) reasons.add(`arg-${kind}-without-options`);
    } else if (kind !== 'boolean' && kind !== 'text') reasons.add(`arg-${kind}`);
  }
  const sorted = [...reasons].sort();
  return { grammar: sorted.length ? 'out' : 'in', reasons: sorted };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = Object.fromEntries(process.argv.slice(2).map((p) => [p, classifyDump(JSON.parse(readFileSync(p, 'utf8')) as DumpFile)]));
  console.log(JSON.stringify(result, null, 2));
}
