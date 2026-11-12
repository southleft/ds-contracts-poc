/**
 * Engine conventions a system profile may switch on (GOAL.md, 2026-11-09: "An engine rule that a profile switches on
 * needs no second kit"). A profile names them in its `conventions`; this list is the converter's own, so an unknown
 * name is refused here by name, and a new convention lands here first, then in a profile. Every convention is off
 * unless a profile turns it on.
 */
/** icon-box-keeps-glyph-size (React to Figma writer): an icon part whose width/height is larger than its glyph, none
 *  smaller (a wrapper element folded into its icon part), is a box holding the glyph at its own size, laid out as the
 *  part declares, instead of a glyph stretched to the box. */
/** svg-rotation-carried (React to Figma contract step): Chromium spells every computed rotation as a matrix, which the
 *  declared `transform` vocabulary does not read; an svg element whose computed transform is a pure rotation is spelled
 *  rotate(<n>deg), so its icon part carries the turn the writer draws (FC-SVG-ROTATION). */
/** closed-select-draws-selected-label (React to Figma contract step): a closed single native select draws one line, its
 *  selected option's label, and its options draw nothing until it opens; the select part takes that label as its text
 *  and its option parts are dropped, instead of every option drawn as a box with its own text. */
export const CONVENTIONS = ['imperceptible-solid-paint-blend-not-carried', 'icon-box-keeps-glyph-size', 'svg-rotation-carried',
  'closed-select-draws-selected-label'] as const;
export type Convention = (typeof CONVENTIONS)[number];

export function conventionSet(names: readonly string[] | undefined): ReadonlySet<Convention> {
  for (const name of names ?? []) if (!(CONVENTIONS as readonly string[]).includes(name)) throw Error(`profile-convention-unknown:${name}`);
  return new Set((names ?? []) as Convention[]);
}

/** Half an 8-bit alpha step: a solid paint below it moves each 8-bit channel of the composite by under half a step, under
 *  NORMAL or MULTIPLY alike (|blend − backdrop| ≤ 1), so an 8-bit render rounds to the backdrop's value. A render kept at
 *  higher precision can still differ. */
export const IMPERCEPTIBLE_ALPHA = 0.5 / 255;

type Composed = { paint?: { blendMode: string; opacity: number }; variableId?: string };

/**
 * imperceptible-solid-paint-blend-not-carried: a solid paint with a non-NORMAL blend mode and alpha under half an 8-bit
 * step (opacity × 255 < 0.5) moves each 8-bit channel by under half a step, so its blend mode is not carried: the node
 * reads as the mapper's NORMAL peer of the same paint (a `sourceNormalFillComposition`, none on TEXT, and a one-paint raw
 * stack reading NORMAL). NORMAL paints, strokes and multi-paint raw stacks are untouched.
 * Reach: every `sourceFillComposition` in a variant's tree, at any depth (children, instance roots, instance content).
 * A set whose every composed fill is so read no longer enters the composed-fill pipeline, so it raises none of the
 * pipeline's 11 `solid-fill-composition-*` throws (packages/core/src/css.ts). A set with any other composed fill still
 * enters it, with these nodes read as NORMAL.
 * This is the one node-level view of the composed-fill fact: applied once, to a copy of the dump, at the public batch
 * door, so every read downstream sees it. The dump itself is not changed. Returns the copy and, per dump key, each layer
 * path whose blend mode was dropped, with that mode.
 */
export function imperceptibleBlendView(dump: Record<string, unknown>): { dump: Record<string, unknown>; dropped: Map<string, Map<string, string>> } {
  const copy = structuredClone(dump), dropped = new Map<string, Map<string, string>>();
  for (const [key, value] of Object.entries(copy)) {
    const set = value as { variants?: unknown[] };
    if (!Array.isArray(set?.variants)) continue;
    const paths = new Map<string, string>();
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) { for (const item of node) walk(item, path); return; }
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>, composed = n.sourceFillComposition as Composed | undefined;
      if (composed?.paint && composed.paint.blendMode !== 'NORMAL' && composed.paint.opacity < IMPERCEPTIBLE_ALPHA) {
        // The mapper's NORMAL peer: none on TEXT (a NORMAL text paint is typography), the NORMAL composition elsewhere,
        // and a one-paint raw stack reading NORMAL too (extract/figma/rest/map.ts, sourceFillComposition and its peer).
        delete n.sourceFillComposition;
        if (n.type !== 'TEXT') n.sourceNormalFillComposition = { paint: { ...composed.paint, blendMode: 'NORMAL' }, ...(composed.variableId !== undefined ? { variableId: composed.variableId } : {}) };
        const stack = n.sourceFillStack as { paints?: Array<{ paint?: { blendMode?: string } }> } | undefined;
        if (stack?.paints?.length === 1 && stack.paints[0]!.paint) stack.paints[0]!.paint.blendMode = 'NORMAL';
        paths.set(path, composed.paint.blendMode);
      }
      for (const [k, v] of Object.entries(n)) {
        if (k === 'children' && Array.isArray(v)) for (const child of v) walk(child, `${path}/${String((child as { name?: unknown })?.name ?? '')}`);
        else if (v && typeof v === 'object') walk(v, path);
      }
    };
    for (const variant of set.variants) walk(variant, '(root)');
    if (paths.size) dropped.set(key, paths);
  }
  return { dump: copy, dropped };
}
