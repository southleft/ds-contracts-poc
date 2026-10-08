/**
 * THE CONTENT CHECK of design:consumer:check (docs/GOAL.md, "Truthful":
 * missing text, icons or parts fail the check).
 *
 * The whole-image limit (5% of pixels, unchanged) cannot see a small loss: the
 * cold-start test (2026-09-28) passed an Altitude Dialog at 0.6% and 0.8% while
 * its "Dialog heading" text and its close icon were missing from the React
 * render. This check asks a narrower question per variant, independent of the
 * pixel score:
 *
 *   text  every TEXT node the Figma variant DRAWS (visible, non-zero opacity,
 *         a rendered box, a visible fill or stroke, non-empty characters) must
 *         appear in the rendered React text: the cell's innerText, input values
 *         and placeholders, string ::before/::after content and SVG text.
 *         Compared case-insensitively with all whitespace removed (CSS
 *         text-transform and line wrapping change neither), and counted: a
 *         string Figma draws twice must render twice.
 *   style each drawn TEXT is then located in the rendered text runs and its
 *         styling compared, character by character (a Figma text with style
 *         overrides has several runs). The first real-kit scoreboard passed an
 *         Atlassian ModalFooter at 1.56% whose "Confirm" React drew black
 *         where Figma draws white; 14 sets drew default black text unseen.
 *           color  the Figma fill (SOLID paints composited, paint opacity
 *                  times the text's and its ancestors' layer opacity) against
 *                  the rendered text's DECLARED computed color (-webkit-text-
 *                  fill-color, SVG fill) times the element's and its
 *                  ancestors' CSS opacity. Never pixels: antialiasing is not a
 *                  text color. The tolerance is what serialization can
 *                  legitimately change: CSS colors are 8-bit per channel, so a
 *                  Figma float channel lands within one 8-bit step (1/255) of
 *                  the value the browser reports. More is a different color.
 *           font   the REQUESTED family (the first family in the computed
 *                  font-family stack, not the face the consumer resolved:
 *                  an unavailable family is font-unavailable-in-consumer's
 *                  finding) and the numeric weight, both exact.
 *         A text whose Figma paint is not solid (gradient, image, blend
 *         mode, stroke only) or whose rendered color is not an sRGB color is
 *         `text-style-unmeasured`, never a pass.
 *   part  every icon or vector the variant draws must have a rendered graphic
 *         element of about the same size. A Figma "part" is the innermost
 *         INSTANCE around a drawn vector whose drawn subtree holds no text (an
 *         icon), else the vector-family node itself. A rendered "graphic" is an
 *         <svg> with a shape, an <img>/<canvas>/<video>, an element painted by
 *         background-image or mask-image, or a text-free leaf element that
 *         paints a background, border or shadow. Parts are matched one to one,
 *         largest first, each within max(3 px, 35%) of its Figma width and
 *         height, preferring the nearest size and then the nearest position.
 *         Grouped Figma icons retain every drawn vector member: each must
 *         match, so a surviving background cannot replace deleted glyphs.
 *         SVG viewports, painted unions and individual drawn shapes are
 *         alternatives sharing paint resources; paint cannot be counted twice. A
 *         part with no match is missing. Position does not decide presence: a
 *         wrong arrangement is the pixel score's finding, not a missing part.
 *
 * The Figma side is read from the REST nodes endpoint at full depth (read
 * only), because the import dump does not record the drawn internals of every
 * instance (a Button's icon slot, for example). Without a token the content
 * check is unavailable and says so; it never passes by default.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fetchFigmaApi } from '../extract/figma/rest/fetch.js';

export interface Box { x: number; y: number; width: number; height: number }
/** Color channels and alpha, each 0..1. */
export interface Rgba { r: number; g: number; b: number; a: number }
interface RestPaint { visible?: boolean; opacity?: number; type?: string; blendMode?: string; color?: { r: number; g: number; b: number; a?: number } }
interface RestTypeStyle { fontFamily?: string; fontWeight?: number; fills?: RestPaint[] }
export interface RestNode {
  id?: string; name?: string; type: string; visible?: boolean; opacity?: number; characters?: string;
  absoluteBoundingBox?: Box | null; absoluteRenderBounds?: Box | null;
  fills?: RestPaint[]; strokes?: RestPaint[]; children?: RestNode[];
  style?: RestTypeStyle; characterStyleOverrides?: number[]; styleOverrideTable?: Record<string, RestTypeStyle>;
}
/** How a run of characters is drawn. `color` null = not comparable, `unmeasured` says why. */
export interface TextStyle { color: Rgba | null; family: string | null; weight: number | null; unmeasured?: string }
/** A run of a Figma text's characters (UTF-16 indices, end exclusive) sharing one style. */
export interface FigmaTextRun extends TextStyle { start: number; end: number }
export interface FigmaPart { name: string; kind: 'icon' | 'vector'; box: Box; members?: Box[] }
/** `textStyles[i]` styles `texts[i]`. */
export interface FigmaContent { texts: string[]; textStyles: FigmaTextRun[][]; parts: FigmaPart[] }
export interface DomGraphic { tag: string; box: Box; members?: Box[] }
/** A rendered text run as the page reports it: raw computed strings, parsed here. */
export interface DomTextRun { text: string; color: string; family: string; weight: string; opacity: number }
export interface DomContent { text: string; graphics: DomGraphic[]; runs?: DomTextRun[] }
export interface TextStyleRow { text: string; figma: string[]; rendered: string[]; color: 'match' | 'mismatch' | 'unmeasured'; font: 'match' | 'mismatch' | 'unmeasured' }
export interface CaseContent {
  key: string;
  texts: { figma: number; missing: string[]; styles?: TextStyleRow[] };
  parts: { figma: number; matched: number; missing: string[] };
}

export const VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'ELLIPSE', 'STAR', 'POLYGON', 'REGULAR_POLYGON', 'LINE']);

const paints = (list: RestPaint[] | undefined) => (list ?? []).some(p => p.visible !== false && (p.opacity ?? 1) > 0);
const shown = (n: RestNode) => n.visible !== false && (n.opacity ?? 1) > 0;
/** REST reports `absoluteRenderBounds: null` for a node that renders nothing. */
const rendered = (n: RestNode) => {
  const box = n.absoluteRenderBounds === undefined ? n.absoluteBoundingBox : n.absoluteRenderBounds;
  return !!box && (box.width > 0 || box.height > 0);
};
const drawsText = (n: RestNode): boolean => shown(n) &&
  (n.type === 'TEXT' ? !!n.characters?.trim() && rendered(n) && (paints(n.fills) || paints(n.strokes)) : (n.children ?? []).some(drawsText));

/** The color a stack of Figma fills paints, times the layer opacity above it.
 *  Only SOLID paints in normal blending composite to one declared color. */
export function figmaFillColor(fills: RestPaint[] | undefined, layerOpacity: number): { color: Rgba } | { unmeasured: string } {
  const drawn = (fills ?? []).filter(p => p.visible !== false && (p.opacity ?? 1) > 0);
  if (!drawn.length) return { unmeasured: 'no visible fill (stroke-only text)' };
  let out: Rgba = { r: 0, g: 0, b: 0, a: 0 };
  for (const p of drawn) { // bottom to top, source-over
    if (p.type !== 'SOLID' || !p.color) return { unmeasured: `${String(p.type ?? 'unknown').toLowerCase().replace(/_/g, '-')} fill` };
    if (p.blendMode && p.blendMode !== 'NORMAL' && p.blendMode !== 'PASS_THROUGH') return { unmeasured: `${p.blendMode.toLowerCase().replace(/_/g, '-')} blend` };
    const a = (p.color.a ?? 1) * (p.opacity ?? 1), below = out.a * (1 - a), total = a + below;
    out = total === 0 ? { r: 0, g: 0, b: 0, a: 0 } : {
      r: (p.color.r * a + out.r * below) / total, g: (p.color.g * a + out.g * below) / total, b: (p.color.b * a + out.b * below) / total, a: total };
  }
  return { color: { ...out, a: out.a * layerOpacity } };
}

/** How each character of a Figma TEXT is drawn: its base style, and every
 *  characterStyleOverrides run with its styleOverrideTable entry over it. */
export function figmaTextRuns(node: RestNode, layerOpacity: number): FigmaTextRun[] {
  const styleOf = (override: RestTypeStyle | undefined): TextStyle => {
    const paint = figmaFillColor(override?.fills ?? node.fills, layerOpacity);
    const family = override?.fontFamily ?? node.style?.fontFamily, weight = override?.fontWeight ?? node.style?.fontWeight;
    const missing = [...('unmeasured' in paint ? [paint.unmeasured] : []), ...(typeof family === 'string' && family ? [] : ['no font family']),
      ...(typeof weight === 'number' && Number.isFinite(weight) ? [] : ['no font weight'])];
    return { color: 'color' in paint ? paint.color : null, family: typeof family === 'string' && family ? family : null,
      weight: typeof weight === 'number' && Number.isFinite(weight) ? weight : null, ...(missing.length ? { unmeasured: missing.join(', ') } : {}) };
  };
  const characters = node.characters ?? '', overrides = node.characterStyleOverrides ?? [], table = node.styleOverrideTable ?? {};
  const runs: Array<{ id: number; start: number; end: number }> = [];
  for (let i = 0; i < characters.length; i++) {
    const id = overrides[i] ?? 0, last = runs.at(-1);
    if (last && last.id === id) last.end = i + 1; else runs.push({ id, start: i, end: i + 1 });
  }
  return runs.map(({ id, start, end }) => ({ start, end, ...styleOf(id ? table[String(id)] : undefined) }));
}

/** What one Figma variant (a REST COMPONENT node, full depth) draws. */
export function figmaContent(variant: RestNode): FigmaContent {
  const origin = variant.absoluteBoundingBox ?? { x: 0, y: 0, width: 0, height: 0 };
  const texts: string[] = [], textStyles: FigmaTextRun[][] = [], parts: FigmaPart[] = [];
  const owners = new Map<RestNode, FigmaPart>();
  const relative = (n: RestNode): Box => {
    const b = n.absoluteBoundingBox ?? n.absoluteRenderBounds ?? { x: origin.x, y: origin.y, width: 0, height: 0 };
    return { x: b.x - origin.x, y: b.y - origin.y, width: b.width, height: b.height };
  };
  // `opacity` = the layer opacity of every ancestor, the variant's own included.
  const walk = (node: RestNode, instances: RestNode[], opacity: number) => {
    if (!shown(node)) return;
    if (node.type === 'TEXT') {
      if (drawsText(node)) { texts.push(node.characters!); textStyles.push(figmaTextRuns(node, opacity * (node.opacity ?? 1))); }
      return;
    }
    if (VECTOR_TYPES.has(node.type)) {
      if (!rendered(node) || !(paints(node.fills) || paints(node.strokes))) return;
      const innermost = instances[instances.length - 1];
      const owner = innermost && !drawsText(innermost) ? innermost : undefined;
      if (owner && owners.has(owner)) { owners.get(owner)!.members!.push(relative(node)); return; }
      const chain = (owner ? instances : [...instances, node]).map(n => n.name ?? n.type);
      const part: FigmaPart = { name: chain.join('/'), kind: owner ? 'icon' : 'vector', box: relative(owner ?? node), ...(owner ? { members: [relative(node)] } : {}) };
      if (owner) owners.set(owner, part);
      parts.push(part);
      return;
    }
    const next = node.type === 'INSTANCE' ? [...instances, node] : instances;
    for (const child of node.children ?? []) walk(child, next, opacity * (node.opacity ?? 1));
  };
  for (const child of variant.children ?? []) walk(child, [], variant.opacity ?? 1);
  return { texts, textStyles, parts };
}

/** Case- and whitespace-insensitive spelling used for every text comparison. */
export const squashText = (text: string) => text.normalize('NFC').toLocaleLowerCase('en-US').replace(/\s+/g, '');

/** The Figma strings the rendered text lacks, counted (a string drawn twice must
 *  render twice). A missing string drawn more than once is named with its count. */
export function missingTexts(figmaTexts: readonly string[], renderedText: string): string[] {
  const corpus = squashText(renderedText);
  const needed = new Map<string, { text: string; count: number }>();
  for (const text of figmaTexts) {
    const key = squashText(text);
    if (!key) continue;
    const entry = needed.get(key) ?? { text: text.trim(), count: 0 };
    entry.count++;
    needed.set(key, entry);
  }
  const missing: string[] = [];
  for (const [key, { text, count }] of needed) {
    const found = corpus.split(key).length - 1;
    if (found < count) missing.push(count - found > 1 ? `${text} (×${count - found})` : text);
  }
  return missing;
}

const within = (figma: number, dom: number) => Math.abs(figma - dom) <= Math.max(3, 0.35 * figma);
/** One-to-one size matching of Figma parts to rendered graphics (see the header). */
export function matchParts(parts: readonly FigmaPart[], graphics: readonly DomGraphic[]): { matched: number; missing: FigmaPart[] } {
  // An SVG viewport and its drawn shapes are alternative representations of
  // the same paint. Consuming either reserves its resources so the viewport
  // cannot stand in for another missing icon after a child was matched.
  const candidates = graphics.flatMap((g, i) => {
    if (!g.members) return [{box:g.box, resources:[`${i}`]}];
    if (!g.members.length) return [];
    const resources=g.members.map((_,j)=>`${i}:${j}`);
    const x=Math.min(...g.members.map(b=>b.x)),y=Math.min(...g.members.map(b=>b.y));
    const painted={x,y,width:Math.max(...g.members.map(b=>b.x+b.width))-x,height:Math.max(...g.members.map(b=>b.y+b.height))-y};
    return [{box:g.box,resources}, {box:painted,resources}, ...g.members.map((box,j)=>({box,resources:[resources[j]]}))];
  });
  const used = new Set<string>();
  const center = (b: Box) => [b.x + b.width / 2, b.y + b.height / 2];
  const order = [...parts].sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
  const missing: FigmaPart[] = [];
  let matched = 0;
  for (const part of order) {
    const reserved=new Set<string>();
    const required=[...(part.members ?? [part.box])].sort((a,b)=>b.width*b.height-a.width*a.height);
    let complete=required.length>0;
    for (const box of required) {
      let best = -1, bestScore: [number, number] = [Infinity, Infinity];
      for (const [i,candidate] of candidates.entries()) {
        if (candidate.resources.some(r=>used.has(r)||reserved.has(r))) continue;
        const g = candidate.box;
        if (!within(box.width, g.width) || !within(box.height, g.height)) continue;
        const [px, py] = center(box), [gx, gy] = center(g);
        const score: [number, number] = [Math.abs(box.width - g.width) + Math.abs(box.height - g.height), Math.hypot(px - gx, py - gy)];
        if (score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) { best = i; bestScore = score; }
      }
      if (best < 0) { complete=false; break; }
      for (const resource of candidates[best].resources) reserved.add(resource);
    }
    if (!complete) missing.push(part);
    else { for (const resource of reserved) used.add(resource); matched++; }
  }
  // Report in the variant's own drawing order.
  return { matched, missing: parts.filter(p => missing.includes(p)) };
}

// ---------------------------------------------------------------------------
// TEXT STYLE (see the header): declared color and requested font, per character.
// ---------------------------------------------------------------------------
/** One 8-bit channel step. The generated CSS and the browser's computed style
 *  carry colors at 8 bits per channel, so a Figma float channel (and its alpha)
 *  lands within one step of the value the browser reports; nothing rendering
 *  does to glyph pixels enters a declared color. */
export const COLOR_STEP = 1 / 255;
export function sameDeclaredColor(a: Rgba, b: Rgba): boolean {
  if (a.a <= COLOR_STEP && b.a <= COLOR_STEP) return true; // neither paints: its hue is not drawn
  return (['r', 'g', 'b', 'a'] as const).every(k => Math.abs(a[k] - b[k]) <= COLOR_STEP + 1e-9);
}
export function colorHex(c: Rgba): string {
  const hex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return '#' + hex(c.r) + hex(c.g) + hex(c.b) + (Math.round(c.a * 255) < 255 ? hex(c.a) : '');
}
/** A computed CSS color as sRGB channels (rgb()/rgba(), color(srgb …),
 *  transparent); null for anything else — another color space, `none`, a paint
 *  server — which is not compared by guesswork. */
export function parseCssColor(value: string): Rgba | null {
  const v = value.trim().toLowerCase();
  if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  const channel = (s: string, scale: number) => s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s) / scale;
  const read = (body: string, scale: number): Rgba | null => {
    const [rgb, alpha] = body.includes('/') ? body.split('/') : [body, undefined];
    const parts = rgb.split(/[\s,]+/).filter(Boolean);
    const a = alpha !== undefined ? alpha.trim() : parts.length === 4 ? parts.pop()! : '1';
    if (parts.length !== 3) return null;
    const out = { r: channel(parts[0], scale), g: channel(parts[1], scale), b: channel(parts[2], scale), a: channel(a, 1) };
    return Object.values(out).every(Number.isFinite) ? out : null;
  };
  const rgb = /^rgba?\(([^()]*)\)$/.exec(v);
  if (rgb) return read(rgb[1], 255);
  const srgb = /^color\(\s*srgb\s+([^()]*)\)$/.exec(v);
  return srgb ? read(srgb[1], 1) : null;
}
/** The family the CSS asks for first: the first entry of a computed font-family stack. */
export function firstFamily(stack: string): string {
  const s = stack.trim();
  if (/^["']/.test(s)) { const end = s.indexOf(s[0], 1); return (end > 0 ? s.slice(1, end) : s.slice(1)).trim(); }
  return s.split(',')[0].trim();
}
const familyKey = (family: string) => family.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');

/** A text's squashed spelling (squashText) built character by character, with
 *  the source index of every squashed unit. */
function squashIndexed(text: string): { squashed: string; from: number[] } {
  let squashed = '';
  const from: number[] = [];
  for (let i = 0; i < text.length;) {
    const ch = String.fromCodePoint(text.codePointAt(i)!), unit = ch.toLocaleLowerCase('en-US').replace(/\s+/g, '');
    squashed += unit;
    for (let k = 0; k < unit.length; k++) from.push(i);
    i += ch.length;
  }
  return { squashed, from };
}
const styleLabel = (s: TextStyle) => `${s.color ? colorHex(s.color) : '?'} ${s.family === null ? '?' : JSON.stringify(s.family)} ${s.weight ?? '?'}`;
/** A Figma text's style at each position of its squashed spelling, or why it cannot be placed. */
function figmaPositions(text: string, runs: FigmaTextRun[] | undefined): TextStyle[] | string {
  const key = squashText(text);
  if (!runs?.length) return 'no Figma text style recorded';
  if (runs.every(r => styleLabel(r) === styleLabel(runs[0]) && r.unmeasured === runs[0].unmeasured)) return Array(key.length).fill(runs[0]);
  const indexed = squashIndexed(text);
  if (indexed.squashed !== key) return 'mixed styles on text that Unicode normalization changes';
  return indexed.from.map(i => runs.find(r => i >= r.start && i < r.end) ?? { color: null, family: null, weight: null, unmeasured: 'character without a style' });
}
/** A rendered run's style: its declared color times its CSS opacity, its requested family and weight. */
function renderedStyle(run: DomTextRun): TextStyle {
  const color = parseCssColor(run.color), weight = Number(run.weight), family = firstFamily(run.family);
  const missing = [...(color ? [] : [`rendered color ${run.color} is not an sRGB color`]), ...(family ? [] : ['no rendered font family']), ...(Number.isFinite(weight) ? [] : ['no rendered font weight'])];
  return { color: color && { ...color, a: color.a * (Number.isFinite(run.opacity) ? run.opacity : 1) }, family: family || null, weight: Number.isFinite(weight) ? weight : null,
    ...(missing.length ? { unmeasured: missing.join(', ') } : {}) };
}

/** Every drawn Figma text, located in the rendered text runs (one to one,
 *  longest first, preferring an occurrence whose style matches) and compared
 *  character by character. A text the presence check already reports missing
 *  is left to it. */
export function compareTextStyles(key: string, figma: FigmaContent, dom: DomContent): { rows: TextStyleRow[]; problems: string[] } {
  const runs = dom.runs ?? [], rendered = runs.map(renderedStyle);
  let corpus = '';
  const runAt: number[] = [];
  runs.forEach((run, r) => { const s = squashIndexed(run.text.normalize('NFC')).squashed; corpus += s; for (let k = 0; k < s.length; k++) runAt.push(r); });
  const presence = squashText(dom.text), needed = new Map<string, number>();
  for (const text of figma.texts) { const k = squashText(text); if (k) needed.set(k, (needed.get(k) ?? 0) + 1); }
  const claimed = new Array<boolean>(corpus.length).fill(false);
  const order = figma.texts.map((text, i) => ({ text, i, squashed: squashText(text) })).filter(t => t.squashed)
    .sort((a, b) => b.squashed.length - a.squashed.length || a.i - b.i);
  const byText = new Map<number, { row: TextStyleRow; problems: string[] }>();
  for (const t of order) {
    const label = JSON.stringify(t.text.trim()), problems: string[] = [];
    const occurrences: number[] = [];
    for (let at = corpus.indexOf(t.squashed); at >= 0; at = corpus.indexOf(t.squashed, at + 1))
      if (!claimed.slice(at, at + t.squashed.length).some(Boolean)) occurrences.push(at);
    const positions = figmaPositions(t.text, figma.textStyles?.[t.i]);
    if (!occurrences.length) {
      if (presence.split(t.squashed).length - 1 < needed.get(t.squashed)!) continue; // content-missing names it
      byText.set(t.i, { row: { text: t.text.trim(), figma: [], rendered: [], color: 'unmeasured', font: 'unmeasured' },
        problems: [`text-style-unmeasured:${key}:${label}:not located in the rendered text runs`] });
      continue;
    }
    const judge = (at: number) => {
      const color = new Set<string>(), font = new Set<string>(), unmeasured = new Set<string>(), figmaSeen = new Set<string>(), renderedSeen = new Set<string>();
      if (typeof positions === 'string') unmeasured.add(positions);
      else positions.forEach((f, j) => {
        const d = rendered[runAt[at + j]];
        figmaSeen.add(styleLabel(f)); renderedSeen.add(styleLabel(d));
        for (const reason of [f.unmeasured, d.unmeasured]) if (reason) unmeasured.add(reason);
        if (f.color && d.color && !sameDeclaredColor(f.color, d.color)) color.add(`figma ${colorHex(f.color)} vs rendered ${colorHex(d.color)}`);
        const fontsKnown = f.family !== null && d.family !== null && f.weight !== null && d.weight !== null;
        if (fontsKnown && (familyKey(f.family!) !== familyKey(d.family!) || f.weight !== d.weight))
          font.add(`figma ${JSON.stringify(f.family)} ${f.weight} vs rendered ${JSON.stringify(d.family)} ${d.weight}`);
      });
      return { at, color, font, unmeasured, figmaSeen, renderedSeen };
    };
    const judged = occurrences.map(judge);
    const chosen = judged.find(j => !j.color.size && !j.font.size && !j.unmeasured.size) ?? judged[0];
    for (let k = chosen.at; k < chosen.at + t.squashed.length; k++) claimed[k] = true;
    if (chosen.color.size) problems.push(`text-color-mismatch:${key}:${label}:${[...chosen.color].join('; ')}`);
    if (chosen.font.size) problems.push(`text-font-mismatch:${key}:${label}:${[...chosen.font].join('; ')}`);
    if (chosen.unmeasured.size) problems.push(`text-style-unmeasured:${key}:${label}:${[...chosen.unmeasured].join('; ')}`);
    const colorUnknown = typeof positions === 'string' || positions.some((f, j) => !f.color || !rendered[runAt[chosen.at + j]].color);
    const fontUnknown = typeof positions === 'string' || positions.some((f, j) => { const d = rendered[runAt[chosen.at + j]]; return f.family === null || f.weight === null || d.family === null || d.weight === null; });
    byText.set(t.i, { problems, row: { text: t.text.trim(), figma: [...chosen.figmaSeen], rendered: [...chosen.renderedSeen],
      color: chosen.color.size ? 'mismatch' : colorUnknown ? 'unmeasured' : 'match', font: chosen.font.size ? 'mismatch' : fontUnknown ? 'unmeasured' : 'match' } });
  }
  // Drawing order; a text drawn twice with the same finding is one line, counted.
  const ordered = [...byText].sort(([a], [b]) => a - b).map(([, v]) => v);
  const counts = new Map<string, number>();
  for (const p of ordered.flatMap(v => v.problems)) counts.set(p, (counts.get(p) ?? 0) + 1);
  return { rows: ordered.map(v => v.row), problems: [...counts].map(([p, n]) => (n > 1 ? `${p} (×${n})` : p)) };
}

/** One case's content verdict and its named problems. */
export function caseContent(key: string, figma: FigmaContent, dom: DomContent): { content: CaseContent; problems: string[] } {
  const texts = missingTexts(figma.texts, dom.text);
  const parts = matchParts(figma.parts, dom.graphics);
  const styles = compareTextStyles(key, figma, dom);
  return {
    content: { key, texts: { figma: figma.texts.length, missing: texts, styles: styles.rows }, parts: { figma: figma.parts.length, matched: parts.matched, missing: parts.missing.map(p => p.name) } },
    problems: [...texts.map(t => `content-missing:${key}:text:${JSON.stringify(t)}`), ...styles.problems, ...parts.missing.map(p => `content-missing:${key}:part:${p.name}`)],
  };
}

/** What a cell renders, read in the page. `el` is the `[data-cell]` wrapper; boxes
 *  are relative to its first element child (the component root, which the
 *  screenshot frames). Serialized as text: tsx would otherwise inject its
 *  __name helper into the page. */
export const domContentOf = new Function('el', `
  const root = el.firstElementChild || el;
  const origin = root.getBoundingClientRect();
  const texts = [el.innerText || ''];
  const alpha = (color) => {
    if (!color || color === 'transparent') return 0;
    const m = /rgba?\\(([^)]*)\\)/.exec(color);
    if (m) { const v = m[1].split(/[\\s,/]+/).filter(Boolean); return v.length > 3 ? parseFloat(v[3]) : 1; }
    return /\\/\\s*0(\\.0*)?\\s*\\)/.test(color) ? 0 : 1;
  };
  const paintsBox = (s) => alpha(s.backgroundColor) > 0 || s.boxShadow !== 'none' ||
    ['Top', 'Right', 'Bottom', 'Left'].some(side => parseFloat(s['border' + side + 'Width']) > 0 && s['border' + side + 'Style'] !== 'none' && alpha(s['border' + side + 'Color']) > 0);
  const visible = (n) => typeof n.checkVisibility === 'function' ? n.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
  const graphics = [];
  for (const n of el.querySelectorAll('*')) {
    if ((n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement) && visible(n)) {
      if (n.value) texts.push(n.value);
      if (n.placeholder && !n.value) texts.push(n.placeholder);
    }
    if (n.localName === 'text' && n.closest('svg') && visible(n)) texts.push(n.textContent || '');
    if (visible(n)) for (const pseudo of ['::before', '::after']) {
      const c = getComputedStyle(n, pseudo).content;
      if (c && /^["']/.test(c)) texts.push(c.slice(1, -1));
    }
    const inSvg = n.parentElement && n.parentElement.closest('svg');
    if (inSvg) continue;
    const r = n.getBoundingClientRect();
    if (!(r.width > 0 || r.height > 0) || !visible(n)) continue;
    const s = getComputedStyle(n), tag = n.localName;
    const graphic = (tag === 'svg' && !!n.querySelector('path, circle, ellipse, rect, line, polyline, polygon, use, image, text')) ||
      tag === 'img' || tag === 'canvas' || tag === 'video' ||
      (s.maskImage && s.maskImage !== 'none') || (s.webkitMaskImage && s.webkitMaskImage !== 'none') || s.backgroundImage !== 'none' ||
      (n.children.length === 0 && !(n.textContent || '').trim() && paintsBox(s));
    if (graphic) {
      const entry = { tag, box: { x: r.x - origin.x, y: r.y - origin.y, width: r.width, height: r.height } };
      if (tag === 'svg') entry.members = [...n.querySelectorAll('path, circle, ellipse, rect, line, polyline, polygon, use, image, text')].filter(shape => {
        if (!visible(shape) || shape.closest('defs, clipPath, mask, pattern, symbol')) return false;
        const paint=getComputedStyle(shape);
        return ['image','text','use'].includes(shape.localName) ||
          (paint.fill !== 'none' && alpha(paint.fill)>0 && parseFloat(paint.fillOpacity)>0) ||
          (paint.stroke !== 'none' && alpha(paint.stroke)>0 && parseFloat(paint.strokeOpacity)>0 && parseFloat(paint.strokeWidth)>0);
      }).map(shape => { const b=shape.getBoundingClientRect(); return {x:b.x-origin.x,y:b.y-origin.y,width:b.width,height:b.height}; }).filter(b=>b.width>0||b.height>0);
      graphics.push(entry);
    }
  }
  // Text runs in document order, each with the DECLARED style it is drawn in:
  // the computed text-fill color (SVG: fill), the family stack as requested,
  // the weight, and the CSS opacity of it and every ancestor inside the cell.
  // Opacity-0 text is kept (its opacity is its finding); visibility and
  // display hide it, as they hide it from innerText.
  const runs = [];
  const opacityOf = (n) => { let a = 1; for (let e = n; e && e !== el; e = e.parentElement) { const o = parseFloat(getComputedStyle(e).opacity); if (o >= 0) a *= o; } return a; };
  const shows = (n) => typeof n.checkVisibility === 'function' ? n.checkVisibility({ visibilityProperty: true }) : true;
  const push = (text, s, owner, svg, ownOpacity) => runs.push({ text, color: svg ? s.fill : (s.webkitTextFillColor || s.color), family: s.fontFamily, weight: s.fontWeight, opacity: opacityOf(owner) * ownOpacity });
  const visit = (n) => {
    if (n.nodeType === 3) {
      const owner = n.parentElement;
      if (owner && n.textContent.trim() && shows(owner)) push(n.textContent, getComputedStyle(owner), owner, !!owner.closest('svg'), 1);
      return;
    }
    if (n.nodeType !== 1 || ['style', 'script', 'template', 'noscript'].includes(n.localName)) return;
    const pseudo = (which) => {
      if (!shows(n)) return;
      const s = getComputedStyle(n, which);
      if (s.content && /^["']/.test(s.content) && s.content.slice(1, -1).trim()) { const o = parseFloat(s.opacity); push(s.content.slice(1, -1), s, n, false, o >= 0 ? o : 1); }
    };
    pseudo('::before');
    if ((n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement) && shows(n)) {
      if (n.value) push(n.value, getComputedStyle(n), n, false, 1);
      else if (n.placeholder) { const s = getComputedStyle(n, '::placeholder'), o = parseFloat(s.opacity); push(n.placeholder, s, n, false, o >= 0 ? o : 1); }
    }
    if (!(n instanceof HTMLTextAreaElement)) for (const child of n.childNodes) visit(child);
    pseudo('::after');
  };
  visit(el);
  return { text: texts.join('\\n'), graphics, runs };
`) as (el: Element) => DomContent;

export type FigmaContentResult =
  | { status: 'collected'; version: string | null; responseSha256: string; byNodeId: Record<string, FigmaContent> }
  | { status: 'unavailable'; reason: string };

/** Read what each variant draws: one read-only GET of the variant nodes at full
 *  depth. The derived content (not the raw response) is written beside the
 *  receipt as figma-content.json, with the response's sha256. */
export async function fetchFigmaContent(fileKey: string, ids: string[], token: string | undefined, out: string,
  get: (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }> =
    (url, init) => fetchFigmaApi(url, init.headers['X-Figma-Token'])): Promise<FigmaContentResult> {
  if (!token) return { status: 'unavailable', reason: 'no token' };
  if (!ids.length || ids.some(id => !id)) return { status: 'unavailable', reason: 'variant node ids unavailable' };
  const response = await get(`https://api.figma.com/v1/files/${encodeURIComponent(fileKey)}/nodes?ids=${ids.join(',')}`, { headers: { 'X-Figma-Token': token } });
  if (!response.ok) return { status: 'unavailable', reason: `HTTP ${response.status}` };
  const bytes = Buffer.from(await response.arrayBuffer());
  const body = JSON.parse(bytes.toString('utf8')) as { version?: string; nodes?: Record<string, { document?: RestNode } | null> };
  const byNodeId: Record<string, FigmaContent> = {};
  for (const id of ids) {
    const node = body.nodes?.[id]?.document;
    if (!node) return { status: 'unavailable', reason: `node ${id} not returned` };
    byNodeId[id] = figmaContent(node);
  }
  const result = { status: 'collected' as const, version: body.version ?? null, responseSha256: createHash('sha256').update(bytes).digest('hex'), byNodeId };
  writeFileSync(path.join(out, 'figma-content.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}
