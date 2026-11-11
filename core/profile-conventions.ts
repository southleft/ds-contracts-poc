/**
 * Engine conventions a system profile may switch on (GOAL.md, 2026-11-09: "An engine rule that a profile switches on
 * needs no second kit"). A profile names them in its `conventions`; this list is the converter's own, so an unknown
 * name is refused here by name, and a new convention lands here first, then in a profile. Every convention is off
 * unless a profile turns it on.
 */
/** icon-box-keeps-glyph-size (React to Figma writer): an icon part whose width/height is larger than its glyph, none
 *  smaller (a wrapper element folded into its icon part), is a box holding the glyph at its own size, laid out as the
 *  part declares, instead of a glyph stretched to the box. */
export const CONVENTIONS = ['imperceptible-solid-paint-blend-not-carried', 'icon-box-keeps-glyph-size'] as const;
export type Convention = (typeof CONVENTIONS)[number];

export function conventionSet(names: readonly string[] | undefined): ReadonlySet<Convention> {
  for (const name of names ?? []) if (!(CONVENTIONS as readonly string[]).includes(name)) throw Error(`profile-convention-unknown:${name}`);
  return new Set((names ?? []) as Convention[]);
}

/** Half an 8-bit alpha step: a solid paint below it composites to the backdrop's own value under every blend mode. */
export const IMPERCEPTIBLE_ALPHA = 0.5 / 255;

type Composed = { paint?: { blendMode: string; opacity: number }; variableId?: string };

/**
 * imperceptible-solid-paint-blend-not-carried: a solid paint whose alpha is under half an 8-bit step (opacity × 255 <
 * 0.5) cannot change a pixel under any blend mode, so its blend mode is not carried; the node reads as the NORMAL peer of
 * the same paint, as the mapper writes one for a NORMAL fill. This is the one node-level view of the composed-fill fact:
 * applied once, to a copy of the dump, at the public batch door, so every read of `sourceFillComposition` and
 * `sourceNormalFillComposition` downstream sees it. The dump itself is not changed. Returns the copy and, per set, each
 * layer path whose blend mode was dropped, with that mode.
 */
export function imperceptibleBlendView(dump: Record<string, unknown>): { dump: Record<string, unknown>; dropped: Map<string, Map<string, string>> } {
  const copy = structuredClone(dump), dropped = new Map<string, Map<string, string>>();
  for (const [key, value] of Object.entries(copy)) {
    const set = value as { setName?: string; variants?: unknown[] };
    if (!Array.isArray(set?.variants)) continue;
    const paths = new Map<string, string>();
    const walk = (node: unknown, path: string): void => {
      if (Array.isArray(node)) { for (const item of node) walk(item, path); return; }
      if (!node || typeof node !== 'object') return;
      const n = node as Record<string, unknown>, composed = n.sourceFillComposition as Composed | undefined;
      if (composed?.paint && composed.paint.blendMode !== 'NORMAL' && composed.paint.opacity < IMPERCEPTIBLE_ALPHA) {
        delete n.sourceFillComposition;
        n.sourceNormalFillComposition = { paint: { ...composed.paint, blendMode: 'NORMAL' }, ...(composed.variableId !== undefined ? { variableId: composed.variableId } : {}) };
        paths.set(path, composed.paint.blendMode);
      }
      for (const [k, v] of Object.entries(n)) {
        if (k === 'children' && Array.isArray(v)) for (const child of v) walk(child, `${path}/${String((child as { name?: unknown })?.name ?? '')}`);
        else if (v && typeof v === 'object') walk(v, path);
      }
    };
    for (const variant of set.variants) walk(variant, '(root)');
    if (paths.size) dropped.set(set.setName ?? key, paths);
  }
  return { dump: copy, dropped };
}
