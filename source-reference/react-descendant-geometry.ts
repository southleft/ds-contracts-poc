/** Geometry BELOW the root of an observed initial-state domain.
 *
 * Sizes: a part's width/height is carried only as its OWN used declaration
 * (style-origin `fixed`, the rule the root uses). A measured box, a percentage
 * or an outer selector's size is never admitted here.
 *
 * Translation: auto-layout has no translate. One exact equivalence is lowered:
 * the SOLE in-flow child of the observed root, translated along the root's
 * main axis by exactly the root's free space, IS main-axis END alignment; the
 * planes where it does not move are START. Every operand is a declared or
 * used CSS length compared in whole 1/64 px layout units. Anything else that
 * translates refuses by name; nothing is approximated and no offset is minted. */
import { flatten, type CapturedNode } from '../extract/computed/lib.js';
import { authoredLengthIsUsed, usedLayoutUnits } from './layout-unit.js';
import type { ReactDescendantSizes } from './react-style-origin.js';

export const descendantTranslateRefusal = 'react-initial-contract-descendant-translate-unqualified';
export type DescendantSizing = Map<string, Set<'width' | 'height'>>;
const insideSvg = (rows: ReturnType<typeof flatten>, path: string) =>
  rows.some(r => r.node.tag === 'svg' && (path === r.path || path.startsWith(r.path === '' ? '' : r.path + '.')));
/** Text boxes keep their own (font-dependent) sizing path; only boxes without direct text are sized here. */
const holdsText = (node: CapturedNode) => node.nodes.some(c => c.t === 'text' && c.v.trim().length > 0);

/** Paths are relative to the observed root. Absent evidence (an archive older
 * than this reader) admits nothing, exactly as before. */
export function descendantFixedSizes(root: CapturedNode, rootPath: string, evidence?: ReactDescendantSizes): DescendantSizing {
  const out: DescendantSizing = new Map();
  if (evidence === undefined) return out;
  if (evidence.version !== 1 || !Array.isArray(evidence.nodes)) throw Error('react-initial-contract-descendant-evidence-mismatch');
  const rows = flatten(root);
  for (const row of rows) {
    if (row.path === '' || insideSvg(rows, row.path)) continue;
    const origin = evidence.nodes.find(n => n.path === (rootPath === '' ? row.path : rootPath + '.' + row.path));
    if (!origin || origin.tag !== row.node.tag) throw Error('react-initial-contract-descendant-evidence-mismatch');
    if (holdsText(row.node)) continue;
    for (const channel of ['width', 'height'] as const) {
      const size = origin.sizes.find(s => s.channel === channel);
      if (size?.status === 'fixed' && size.value && authoredLengthIsUsed(size.value, row.node.style[channel]))
        (out.get(row.path) ?? out.set(row.path, new Set()).get(row.path)!).add(channel);
    }
  }
  return out;
}

const tokens = (value: string) => { // top-level whitespace split
  const out: string[] = []; let depth = 0, current = '';
  for (const c of value.trim()) {
    if (c === '(') depth++; else if (c === ')') depth--;
    if (!depth && /\s/.test(c)) { if (current) out.push(current); current = ''; } else current += c;
  }
  if (current) out.push(current);
  return out;
};
const number = String.raw`(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)`;
/** A computed <length-percentage> in layout units against its reference box. Only
 * the forms Chromium serializes for px, % and one `calc(% ± px)` are read. */
const lengthPercent = (token: string, box: number | undefined): number | undefined => {
  let m = new RegExp(`^${number}px$`).exec(token);
  if (m) return Number(m[1]) * 64;
  if (box === undefined) return undefined;
  if ((m = new RegExp(`^${number}%$`).exec(token))) return Number(m[1]) / 100 * box;
  if ((m = new RegExp(`^calc\\(${number}% ([+-]) ${number}px\\)$`).exec(token))) return Number(m[1]) / 100 * box + (m[2] === '-' ? -1 : 1) * Number(m[3]) * 64;
  return undefined;
};
const units = (style: Record<string, string>, channels: string[]) => {
  let sum = 0;
  for (const channel of channels) { const n = usedLayoutUnits(style[channel] ?? ''); if (n === undefined) return undefined; sum += n; }
  return sum;
};
const sides = { x: ['left', 'right'], y: ['top', 'bottom'] } as const, size = { x: 'width', y: 'height' } as const;
const edges = (axis: 'x' | 'y') => sides[axis].flatMap(s => [`padding-${s}`, `border-${s}-width`]);
const borderBox = (style: Record<string, string>, axis: 'x' | 'y') =>
  units(style, [size[axis], ...(style['box-sizing'] === 'border-box' ? [] : edges(axis))]);

/** The element's translation in layout units (percentages resolve against its
 * own border box), and whether any other transform is present. `undefined`:
 * a translation exists that this grammar cannot resolve. */
function translation(style: Record<string, string>): { x: number; y: number; other: boolean } | undefined {
  let x = 0, y = 0, other = (style.rotate ?? 'none') !== 'none' || (style.scale ?? 'none') !== 'none';
  const translate = style.translate ?? 'none', transform = style.transform ?? 'none';
  if (translate !== 'none') {
    const parts = tokens(translate);
    if (!parts.length || parts.length > 3 || parts[2] !== undefined && parts[2] !== '0px') return undefined;
    const read = parts.slice(0, 2).map((token, i) => lengthPercent(token, borderBox(style, i ? 'y' : 'x')));
    if (read.some(v => v === undefined || !Number.isFinite(v))) return undefined;
    x += read[0]!; y += read[1] ?? 0;
  }
  if (transform !== 'none') {
    const m = new RegExp(`^matrix\\(${Array(6).fill(number).join(', ')}\\)$`).exec(transform);
    if (!m) return undefined;
    const [a, b, c, d, tx, ty] = m.slice(1).map(Number);
    if (a !== 1 || b !== 0 || c !== 0 || d !== 1) other = true;
    x += tx * 64; y += ty * 64;
  }
  return { x, y, other };
}

export interface DescendantAlignment { path: string; axis: 'x' | 'y'; planes: Record<string, 'start' | 'end'> }
const outOfFlow = (s: Record<string, string>) => ['absolute', 'fixed'].includes(s.position) || s.display === 'none';

/** Finds every translated descendant across the planes and lowers the one
 * qualified form by REWRITING the cloned roots' `justify-content`: the layout
 * vocabulary then carries it per variant and the caller verifies the compiled
 * variants. `sizing` and `rootFixed` name the sizes the contract carries as
 * source facts. A rotation or scale on an element that never translates is
 * outside this rule and is left exactly as before. */
export function lowerDescendantTranslations(planes: Map<string, { root: CapturedNode; sizing: DescendantSizing }>,
  rootFixed: ReadonlySet<string>): DescendantAlignment[] {
  const refuse = (reason: string): never => { throw Error(descendantTranslateRefusal + ':' + reason); };
  const moved = new Set<string>();
  for (const plane of planes.values()) for (const row of flatten(plane.root)) {
    if (row.path === '') continue;
    const t = translation(row.node.style);
    if (!t || t.x || t.y) moved.add(row.path);
  }
  const out: DescendantAlignment[] = [];
  for (const path of [...moved].sort()) {
    if (path.includes('.')) refuse('parent-not-observed-root');
    const alignment: DescendantAlignment = { path, axis: 'x', planes: {} };
    for (const [key, plane] of planes) {
      const root = plane.root, parent = root.style, children = root.nodes.flatMap(c => c.t === 'el' ? [c.el] : []);
      const child = children[Number(path)];
      if (!child) return refuse('conditional-element');
      const t = translation(child.style);
      if (!t) return refuse('translation-unresolved');
      if (t.other) refuse('rotation-or-scale-present');
      const direction = parent['flex-direction'];
      if (!['flex', 'inline-flex'].includes(parent.display) || !['row', 'column'].includes(direction) || (parent['flex-wrap'] ?? 'nowrap') !== 'nowrap')
        refuse('parent-not-single-line-flex');
      if ((parent.direction ?? 'ltr') !== 'ltr' || (parent['writing-mode'] ?? 'horizontal-tb') !== 'horizontal-tb') refuse('rtl-or-vertical-writing');
      if (!['normal', 'flex-start'].includes(parent['justify-content'])) refuse('parent-justification-not-start');
      const axis = direction === 'row' ? 'x' : 'y';
      if (Object.keys(alignment.planes).length && alignment.axis !== axis) refuse('parent-not-single-line-flex');
      alignment.axis = axis;
      if (children.some(c => c !== child && !outOfFlow(c.style)) || holdsText(root) ||
          Object.entries(root.pseudo).some(([name, s]) => ['::before', '::after'].includes(name) && s && !outOfFlow(s)))
        refuse('not-sole-in-flow-child');
      if (child.style.position !== 'static') refuse('child-positioned');
      if (t[axis === 'x' ? 'y' : 'x']) refuse('cross-axis-translation');
      if (!rootFixed.has(size[axis])) refuse('parent-main-size-not-fixed');
      if (!plane.sizing.get(path)?.has(size[axis])) refuse('child-main-size-not-own-fixed');
      const container = borderBox(parent, axis), inner = units(parent, edges(axis)), box = borderBox(child.style, axis),
        margins = units(child.style, sides[axis].map(s => `margin-${s}`));
      if (container === undefined || inner === undefined || box === undefined || margins === undefined) return refuse('translation-unresolved');
      // Free space is whole layout units; the translation must BE it, not be near it.
      if (t[axis] !== 0 && t[axis] !== container - inner - box - margins) refuse('partial-free-space');
      alignment.planes[key] = t[axis] === 0 ? 'start' : 'end';
    }
    // `normal` is start in a flex container; spell both so the variance factors on the driving axis.
    for (const [key, plane] of planes) plane.root.style['justify-content'] = alignment.planes[key] === 'end' ? 'flex-end' : 'flex-start';
    out.push(alignment);
  }
  return out;
}
