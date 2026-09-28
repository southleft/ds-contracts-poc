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
 *   part  every icon or vector the variant draws must have a rendered graphic
 *         element of about the same size. A Figma "part" is the innermost
 *         INSTANCE around a drawn vector whose drawn subtree holds no text (an
 *         icon), else the vector-family node itself. A rendered "graphic" is an
 *         <svg> with a shape, an <img>/<canvas>/<video>, an element painted by
 *         background-image or mask-image, or a text-free leaf element that
 *         paints a background, border or shadow. Parts are matched one to one,
 *         largest first, each within max(3 px, 35%) of its Figma width and
 *         height, preferring the nearest size and then the nearest position. A
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
interface RestPaint { visible?: boolean; opacity?: number }
export interface RestNode {
  id?: string; name?: string; type: string; visible?: boolean; opacity?: number; characters?: string;
  absoluteBoundingBox?: Box | null; absoluteRenderBounds?: Box | null;
  fills?: RestPaint[]; strokes?: RestPaint[]; children?: RestNode[];
}
export interface FigmaPart { name: string; kind: 'icon' | 'vector'; box: Box }
export interface FigmaContent { texts: string[]; parts: FigmaPart[] }
export interface DomGraphic { tag: string; box: Box }
export interface DomContent { text: string; graphics: DomGraphic[] }
export interface CaseContent {
  key: string;
  texts: { figma: number; missing: string[] };
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

/** What one Figma variant (a REST COMPONENT node, full depth) draws. */
export function figmaContent(variant: RestNode): FigmaContent {
  const origin = variant.absoluteBoundingBox ?? { x: 0, y: 0, width: 0, height: 0 };
  const texts: string[] = [], parts: FigmaPart[] = [];
  const owners = new Set<RestNode>();
  const relative = (n: RestNode): Box => {
    const b = n.absoluteBoundingBox ?? n.absoluteRenderBounds ?? { x: origin.x, y: origin.y, width: 0, height: 0 };
    return { x: b.x - origin.x, y: b.y - origin.y, width: b.width, height: b.height };
  };
  const walk = (node: RestNode, instances: RestNode[]) => {
    if (!shown(node)) return;
    if (node.type === 'TEXT') {
      if (drawsText(node)) texts.push(node.characters!);
      return;
    }
    if (VECTOR_TYPES.has(node.type)) {
      if (!rendered(node) || !(paints(node.fills) || paints(node.strokes))) return;
      const innermost = instances[instances.length - 1];
      const owner = innermost && !drawsText(innermost) ? innermost : undefined;
      if (owner && owners.has(owner)) return;
      const chain = (owner ? instances : [...instances, node]).map(n => n.name ?? n.type);
      if (owner) owners.add(owner);
      parts.push({ name: chain.join('/'), kind: owner ? 'icon' : 'vector', box: relative(owner ?? node) });
      return;
    }
    const next = node.type === 'INSTANCE' ? [...instances, node] : instances;
    for (const child of node.children ?? []) walk(child, next);
  };
  for (const child of variant.children ?? []) walk(child, []);
  return { texts, parts };
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
  const free = new Set(graphics.map((_, i) => i));
  const center = (b: Box) => [b.x + b.width / 2, b.y + b.height / 2];
  const order = [...parts].sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
  const missing: FigmaPart[] = [];
  let matched = 0;
  for (const part of order) {
    let best = -1, bestScore: [number, number] = [Infinity, Infinity];
    for (const i of free) {
      const g = graphics[i].box;
      if (!within(part.box.width, g.width) || !within(part.box.height, g.height)) continue;
      const [px, py] = center(part.box), [gx, gy] = center(g);
      const score: [number, number] = [Math.abs(part.box.width - g.width) + Math.abs(part.box.height - g.height), Math.hypot(px - gx, py - gy)];
      if (score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) { best = i; bestScore = score; }
    }
    if (best < 0) missing.push(part);
    else { free.delete(best); matched++; }
  }
  // Report in the variant's own drawing order.
  return { matched, missing: parts.filter(p => missing.includes(p)) };
}

/** One case's content verdict and its named problems. */
export function caseContent(key: string, figma: FigmaContent, dom: DomContent): { content: CaseContent; problems: string[] } {
  const texts = missingTexts(figma.texts, dom.text);
  const parts = matchParts(figma.parts, dom.graphics);
  return {
    content: { key, texts: { figma: figma.texts.length, missing: texts }, parts: { figma: figma.parts.length, matched: parts.matched, missing: parts.missing.map(p => p.name) } },
    problems: [...texts.map(t => `content-missing:${key}:text:${JSON.stringify(t)}`), ...parts.missing.map(p => `content-missing:${key}:part:${p.name}`)],
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
    if (graphic) graphics.push({ tag, box: { x: r.x - origin.x, y: r.y - origin.y, width: r.width, height: r.height } });
  }
  return { text: texts.join('\\n'), graphics };
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
