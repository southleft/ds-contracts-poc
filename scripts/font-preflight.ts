/**
 * FONT PREFLIGHT (docs/GOAL.md Step 2, AGENTS.md rule 9). Fonts are inputs: before
 * anything is packaged or checked, every font face a design's text uses must be
 * supplied. A missing face is refused here by name, with the variants that use it,
 * so it is never a pass and never a conversion failure, and its variants are
 * counted in their own font-blocked column. Deterministic, no installed-font
 * lookup. The comparison takes any list of available faces, so React to Figma
 * holds the faces the Storybook reader saw each variant drawn with against
 * Figma's font list (the plugin capture's `figmaFonts`), before anything is
 * written to Figma.
 *
 * React to Figma: npx tsx scripts/font-preflight.ts --stories <reader out>/stories.json
 *   --capture <any set>.capture.json --out <dir>   (exit 3 names each missing face)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
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

/** Faces with every variant that draws each, sorted. */
function tally() {
  const faces = new Map<string, FontFace & { variants: Set<string> }>();
  return {
    add: (face: FontFace, variant: string) => { (faces.get(key(face)) ?? faces.set(key(face), { ...face, variants: new Set() }).get(key(face))!).variants.add(variant); },
    list: (): RequiredFace[] => [...faces.values()].map((f) => ({ ...f, variants: [...f.variants].sort() })).sort(order),
  };
}

/** Every face drawn by any set in the dump (nested sets render inside the package too). */
export function requiredFaces(file: DumpFile): RequiredFace[] {
  const faces = tally();
  const sets = Object.values(file).filter((v): v is DumpSet => !!v && typeof v === 'object' && Array.isArray((v as DumpSet).variants));
  for (const set of sets) for (const variant of set.variants) {
    const visit = (n: DumpNode): void => {
      if (n.text) faces.add(faceOf(n.text), `${set.setName} / ${variant.name}`);
      (n.children ?? []).forEach(visit);
    };
    visit(variant);
  }
  return faces.list();
}

export const covers = (available: AvailableFace, face: FontFace): boolean => {
  const [low, high = low] = available.weight.split(' ').map(Number);
  return available.family.toLowerCase() === face.family.toLowerCase() && available.style === face.style && low! <= face.weight && face.weight <= high!;
};

export function fontPreflight(file: DumpFile, available: readonly AvailableFace[]): { required: RequiredFace[]; missing: RequiredFace[] } {
  const required = requiredFaces(file);
  return { required, missing: required.filter((face) => !available.some((a) => covers(a, face))) };
}

/** One entry of Figma's font list; its style name gives the weight, as for a dump's text. */
export const figmaFace = (f: { family: string; style: string }): AvailableFace => {
  const face = faceOf({ fontFamily: f.family, fontStyle: f.style });
  return { family: face.family, weight: String(face.weight), style: face.style };
};

/** React to Figma: every face the reader saw a variant drawn with, named `component / variant index` (the
 *  matrix's order), held against Figma's font list by the same comparison. */
export function storyFontPreflight(components: ReadonlyArray<{ title: string; references: ReadonlyArray<{ faces?: FontFace[] }> }>,
  figmaFonts: ReadonlyArray<{ family: string; style: string }>): { required: RequiredFace[]; missing: RequiredFace[] } {
  const faces = tally();
  for (const c of components) c.references.forEach((r, i) => { for (const face of r.faces ?? []) faces.add(face, `${c.title} / ${i}`); });
  const required = faces.list(), available = figmaFonts.map(figmaFace);
  return { required, missing: required.filter((face) => !available.some((a) => covers(a, face))) };
}

if (process.argv[1] && /font-preflight\.ts$/.test(process.argv[1])) {
  const flag = (name: string) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
  const stories = flag('--stories'), capture = flag('--capture'), out = flag('--out');
  if (!stories || !capture || !out) { console.error('usage: npx tsx scripts/font-preflight.ts --stories <stories.json> --capture <set.capture.json> --out <dir>'); process.exit(2); }
  const { figmaFonts } = JSON.parse(readFileSync(capture, 'utf8')) as { figmaFonts?: Array<{ family: string; style: string }> };
  if (!Array.isArray(figmaFonts)) { console.error(`✖ font-preflight: ${capture} has no figmaFonts; capture again with this plugin build`); process.exit(2); }
  const preflight = storyFontPreflight((JSON.parse(readFileSync(stories, 'utf8')) as { components: Parameters<typeof storyFontPreflight>[0] }).components, figmaFonts);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'font-preflight.json'), JSON.stringify({ version: 1, direction: 'react-to-figma', stories, capture, ...preflight }, null, 2) + '\n');
  for (const f of preflight.missing)
    console.error(`✖ font-preflight: ${f.family} ${f.weight} ${f.style} is not in Figma's font list (${f.variants.length} variant(s), first ${f.variants[0]})`);
  if (preflight.missing.length) {
    console.error(`  Fonts are inputs: install every face the library renders with where Figma runs, then capture again. Nothing was written to Figma; see ${path.join(out, 'font-preflight.json')}.`);
    process.exit(3);
  }
  console.log(`font preflight: ${preflight.required.length} face(s) drawn, all in Figma's font list`);
}
