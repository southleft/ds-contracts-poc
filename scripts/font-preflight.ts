/**
 * FONT PREFLIGHT (docs/GOAL.md Step 2, AGENTS.md rule 9). Fonts are inputs: before
 * anything is packaged or checked, every font face a design's text uses must be
 * supplied. A missing face is refused here by name, with the variants that use it,
 * so it is never a pass and never a conversion failure, and its variants are
 * counted in their own font-blocked column. Deterministic, no installed-font
 * lookup. The comparison takes any list of available faces, so the React to
 * Figma direction can hold a story's rendered fonts against Figma's font list.
 */
import type { DumpFile, DumpNode, DumpSet, DumpText } from '../extract/figma/types.js';

export interface FontFace { family: string; weight: number; style: 'normal' | 'italic' }
/** A face the design draws, with every `set / variant` that draws it. */
export interface RequiredFace extends FontFace { variants: string[] }
/** An available face; `weight` is one number or a variable range ("100 900"). */
export interface AvailableFace { family: string; weight: string; style: 'normal' | 'italic' }

// Order matters: "extra light" before "light", "semi bold" and "extra bold" before "bold".
const NAMED_WEIGHTS: Array<[RegExp, number]> = [
  [/thin|hairline/, 100], [/(extra|ultra)\s*light/, 200], [/light/, 300], [/medium/, 500],
  [/(semi|demi)\s*bold/, 600], [/(extra|ultra)\s*bold/, 800], [/bold/, 700], [/black|heavy/, 900],
];

/** The face one text draws: the recorded numeric weight, else the style name's weight. */
export function faceOf(text: Pick<DumpText, 'fontFamily' | 'fontStyle' | 'fontWeight'>): FontFace {
  const style = text.fontStyle.toLowerCase();
  const named = NAMED_WEIGHTS.find(([pattern]) => pattern.test(style))?.[1] ?? 400;
  return { family: text.fontFamily ?? '(family not recorded)', weight: text.fontWeight ?? named, style: /italic|oblique/.test(style) ? 'italic' : 'normal' };
}

const key = (f: FontFace) => `${f.family.toLowerCase()}\u0000${f.weight}\u0000${f.style}`;
const order = (a: FontFace, b: FontFace) => a.family.localeCompare(b.family) || a.weight - b.weight || a.style.localeCompare(b.style);

/** Every face drawn by any set in the dump (nested sets render inside the package too). */
export function requiredFaces(file: DumpFile): RequiredFace[] {
  const faces = new Map<string, FontFace & { variants: Set<string> }>();
  const sets = Object.values(file).filter((v): v is DumpSet => !!v && typeof v === 'object' && Array.isArray((v as DumpSet).variants));
  for (const set of sets) for (const variant of set.variants) {
    const visit = (n: DumpNode): void => {
      if (n.text) {
        const face = faceOf(n.text);
        const entry = faces.get(key(face)) ?? faces.set(key(face), { ...face, variants: new Set() }).get(key(face))!;
        entry.variants.add(`${set.setName} / ${variant.name}`);
      }
      (n.children ?? []).forEach(visit);
    };
    visit(variant);
  }
  return [...faces.values()].map((f) => ({ ...f, variants: [...f.variants].sort() })).sort(order);
}

export const covers = (available: AvailableFace, face: FontFace): boolean => {
  const [low, high = low] = available.weight.split(' ').map(Number);
  return available.family.toLowerCase() === face.family.toLowerCase() && available.style === face.style && low! <= face.weight && face.weight <= high!;
};

export function fontPreflight(file: DumpFile, available: readonly AvailableFace[]): { required: RequiredFace[]; missing: RequiredFace[] } {
  const required = requiredFaces(file);
  return { required, missing: required.filter((face) => !available.some((a) => covers(a, face))) };
}
