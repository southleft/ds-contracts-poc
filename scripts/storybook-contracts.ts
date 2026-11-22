/**
 * React to Figma, the code side (GOAL.md Step 2): writes `ds-contracts.react.json` from the Storybook reader's
 * `stories.json`, then, for each in-grammar component, a contract and the Figma scripts that write it.
 *
 * Route (2026-11-08, from a probe of five Agriculture components): every case renders on the story's own page,
 * through the reader's own `SHOW` in its pinned browser. Storybook's decorators (A0 wraps every story in its theme
 * provider), its React and its CSS are then the ones the reader's references were drawn with. The computed engine
 * reads the DOM and computed styles, and the Figma engine prepares the scripts. The source-reference engine was not
 * used: it mounts each component outside Storybook (decorators lost), under its own React 19.x observer (A0 runs
 * 18.3), and needs a witness per case, which is regression only (owner, 2026-10-31).
 *
 * `stories.json` supplies only the matrix: story ids, arguments and variant values. The reader's reference images and
 * measured content are never read. A component outside the grammar, or whose matrix is refused, is refused by name.
 *
 *   npx tsx scripts/storybook-contracts.ts --stories <stories.json> --out <dir> [--storybook <url>] [--titles "a|b"]
 *     [--file-key <key>]   with a file key, the variables and component scripts for that file only
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createFigmaEngine } from '../core/emit-figma-script.js';
import { conventionSet } from '../core/profile-conventions.js';
import { mintTokens } from '../core/mint-tokens.js';
import { promoteAnatomy } from '../extract/computed/anatomy.js';
import { captureJs, captureUaControls, CONTROL_TAGS, SHADOW_HELPERS_JS, type ComponentConfig, type PropSpace, type SweepResult } from '../extract/computed/capture.js';
import { alignSweep, applyMintToContract, boundCheck, detectFolds, enrichLayout, hugEvidence, prepareMint, styledChannels } from '../extract/computed/fuse.js';
import { comboKey, normalizeNode, type Capture, type CapturedNode, type EnumAxisSpec } from '../extract/computed/lib.js';
import { ContractSchema, DECLARED_CHANNELS, LITERAL_CHANNELS, TOKEN_CHANNELS, lineBoxIssues, textBaselineIssues, textByCombinationIssues, type Contract, type Part } from './contract-schema.js';
import { NO_MOTION } from './design-consumer-check.js';
import { MARK_SUBJECT, PAGE, pinnedBrowser, readerStoryIds, SELECT_INSTANCE, SHOW, SystemProfile, type StoryComponent } from './storybook-reader.js';
import type { CDPSession } from 'playwright-core';

export interface StoryCase { id: string; story: { id: string; args: Record<string, unknown>; instance?: number }; variant: Record<string, string> }
export interface DeclaredComponent { subject: string; name: string; axes: string[]; cases: StoryCase[] }
export interface StoryDeclaration {
  version: 2; source: 'storybook'; storybook: string; react: string | null;
  components: DeclaredComponent[]; refused: { subject: string; reason: string }[];
}
interface ReaderOutput { storybook: string; environment?: { react?: string }; components: StoryComponent[]; profile?: { path: string; sha256: string } | null;
  index?: { sha256: string }; only?: { path: string; sha256: string } }

/** The stories the reader loaded before it drew any reference, in its order: the reader's own readerStoryIds over the
 * index, profile and --only list it recorded, each refused by name if its bytes changed since the reader read them. A
 * story module's stylesheets stay on the page once loaded, so the contract step loads the same ones, in the same order,
 * before its first case: each case is then captured beside the stylesheets its reference was drawn beside, whichever
 * sets run and in what order. A reader output that recorded no index: none, as before. */
export function readerPreload(stories: Pick<ReaderOutput, 'index' | 'only' | 'profile'>, indexText: string, read: (file: string) => Buffer = (file) => readFileSync(file)): string[] {
  if (!stories.index) return [];
  if (createHash('sha256').update(indexText).digest('hex') !== stories.index.sha256) throw Error('index-changed-since-read');
  const every = Object.values((JSON.parse(indexText) as { entries: Record<string, { type: string; id: string; title?: string }> }).entries).filter((e) => e.type === 'story');
  return readerStoryIds(every, stories.only ? profileDeclarations(stories, read) : [], stories.only && new Set(recordedJson('only', stories.only, read) as string[]));
}

/** A file the reader recorded (its path and sha256), parsed as JSON, refused by name if its bytes changed since. */
function recordedJson(what: string, f: { path: string; sha256: string }, read: (file: string) => Buffer): unknown {
  const b = read(f.path);
  if (createHash('sha256').update(b).digest('hex') !== f.sha256) throw Error(`${what}-changed-since-read:${f.path}`);
  return JSON.parse(b.toString());
}

/** The component declarations of the profile the reader recorded, refused by name if its bytes changed since; none
 *  when it recorded no profile. */
export const profileDeclarations = (stories: Pick<ReaderOutput, 'profile'>, read: (file: string) => Buffer = (file) => readFileSync(file)) =>
  stories.profile ? SystemProfile.parse(recordedJson('profile', stories.profile, read)).components : [];

/** Profile convention svg-rotation-carried: an svg element whose computed transform is a pure rotation (matrix(cos θ,
 * sin θ, −sin θ, cos θ, 0, 0), θ ≠ 0) is spelled rotate(θdeg), in place; every other transform stays as captured. */
export function spellSvgRotation(node: CapturedNode): void {
  const m = /^matrix\(([^,]+), ([^,]+), ([^,]+), ([^,]+), ([^,]+), ([^,]+)\)$/.exec(node.style['transform'] ?? '');
  const [a, b, c, d, e, f] = m ? m.slice(1).map(Number) : [];
  if (node.tag === 'svg' && m && e === 0 && f === 0 && !(a === 1 && b === 0) && Math.abs(a! - d!) < 1e-4 && Math.abs(b! + c!) < 1e-4 && Math.abs(a! * a! + b! * b! - 1) < 1e-3)
    node.style['transform'] = `rotate(${+((Math.atan2(b!, a!) * 180) / Math.PI).toFixed(3)}deg)`;
  for (const k of node.nodes) if (k.t === 'el') spellSvgRotation(k.el);
}

/** Profile convention svg-viewbox-carried: the viewBox and preserveAspectRatio attributes of each svg under the captured
 *  root, in the capture's own tree order (open shadow roots and slots as it walks them, svg metadata skipped). */
export const SVG_VIEWPORTS = (rootPath?: readonly string[]) => `(() => { ${SHADOW_HELPERS_JS}
  const root = ${rootPath ? `document.querySelector(${JSON.stringify(rootPath[0])})` : `shStageRoot(document.querySelector('[data-ds-reader-cell]'))`}, out = [];
  const walk = (el) => { if (el.localName === 'svg') out.push([el.getAttribute('viewBox'), el.getAttribute('preserveAspectRatio')]);
    for (const c of shChildNodesOf(el)) if (c.nodeType === 1 && !(c instanceof SVGElement && ['title', 'desc', 'metadata'].includes(c.localName))) walk(c); };
  if (root) walk(root); return out; })()`;

/** Profile convention svg-viewbox-carried: each captured svg takes the viewBox its page authored, in tree order, when it
 *  is square on a square svg box under the default aspect mapping (the form the svg reconstruction reads); any other
 *  svg keeps the viewBox reconstructed from its computed size. With svg-viewbox-meets-oblong-box (`oblong`), a square
 *  viewBox on an oblong svg box is taken too: the reconstruction centers its glyph square in the box, as `meet` does. False, and nothing attached, when the page and the
 *  capture disagree on how many svgs there are. */
export function carrySvgViewports(root: CapturedNode, seen: ReadonlyArray<readonly [string | null, string | null]>, oblong = false): boolean {
  const svgs: CapturedNode[] = [], walk = (n: CapturedNode) => { if (n.tag === 'svg') svgs.push(n); for (const k of n.nodes) if (k.t === 'el') walk(k.el); };
  walk(root);
  if (svgs.length !== seen.length) return false;
  svgs.forEach((n, i) => {
    const [vb, aspect] = seen[i]!, box = (vb ?? '').trim().split(/[\s,]+/).map(Number);
    if (box.length === 4 && box.every(Number.isFinite) && box[2]! > 0 && box[2] === box[3] && /^\d+(\.\d+)?px$/.test(n.style['width'] ?? '') &&
        (n.style['width'] === n.style['height'] || (oblong && /^\d+(\.\d+)?px$/.test(n.style['height'] ?? ''))) &&
        ['xMidYMid', 'xMidYMid meet'].includes((aspect ?? 'xMidYMid meet').trim().replace(/\s+/g, ' ')))
      n.svgViewport = { viewBox: box as [number, number, number, number], preserveAspectRatio: 'xMidYMid meet',
        ...(n.style['width'] !== n.style['height'] ? { oblong: true as const } : {}) };
  });
  return true;
}

/** Profile convention capture-marked-subject: each case is captured from the element the reader marked as the
 *  instance's top (`data-ds-reader-subject`), the element its reference was drawn from, as a selected instance already
 *  is. Off, a case with no selected instance is captured from the cell's first drawn child, which differs from the
 *  subject when the story draws something else before the instance in the same parent. */
export function captureRootPath(own: number | undefined, conventions: ReadonlySet<string>): string[] | undefined {
  return own !== undefined || conventions.has('capture-marked-subject') ? ['[data-ds-reader-subject]'] : undefined;
}
/** True when the cell's first drawn child, the root the capture reads without the convention, is not the marked subject. */
export const SUBJECT_IS_NOT_STAGE_ROOT = `(() => { ${SHADOW_HELPERS_JS}
  return shStageRoot(document.querySelector('[data-ds-reader-cell]')) !== document.querySelector('[data-ds-reader-subject]'); })()`;

/** Profile convention normal-line-height-as-drawn: an element whose computed line-height is `normal` (the font's own
 *  spacing, which no px value names, so its text would take an ancestor's px line height) and which holds one line of
 *  its own text and no elements takes the line height Chromium drew, its content-box height, as a px value. An inline box
 *  (no height), one with element children, one two or more lines tall (content at least twice its font size) and one
 *  shorter than its font size (a clipped, visually hidden box draws no line) stay as captured. Returns how many changed. */
export function spellNormalLineHeight(node: CapturedNode): number {
  const s = node.style, px = (k: string) => /^-?\d+(\.\d+)?px$/.test(s[k] ?? '') ? Number.parseFloat(s[k]!) : null;
  const own = node.nodes.some((k) => k.t === 'text' && k.v.trim()) && node.nodes.every((k) => k.t === 'text');
  const edges = s['box-sizing'] === 'border-box' ? ['padding-top', 'padding-bottom', 'border-top-width', 'border-bottom-width'].reduce((a, k) => a + (px(k) ?? 0), 0) : 0;
  const line = (px('height') ?? 0) - edges, size = px('font-size') ?? 0;
  let changed = 0;
  if (s['line-height'] === 'normal' && own && line >= size && line < 2 * size) { s['line-height'] = `${+line.toFixed(4)}px`; changed++; }
  for (const k of node.nodes) if (k.t === 'el') changed += spellNormalLineHeight(k.el);
  return changed;
}

/** A captured channel some registry carries (token, literal or declared). */
export const carriedChannel = (channel: string): boolean =>
  channel in TOKEN_CHANNELS || LITERAL_CHANNELS.has(channel) || channel in DECLARED_CHANNELS;
/** Profile convention unregistered-channel-not-minted: a fact on a channel no registry carries, which would make the
 *  contract's validation refuse the whole set if minted, is left out of the mint and named once per part and channel.
 *  Off, every observation is minted as before. */
export function mintedObservations<T extends { part: string; cssProperty: string }>(base: T[], state: T[], on: boolean) {
  if (!on) return { baseObs: base, stateObs: state, named: [] as string[] };
  return { baseObs: base.filter((o) => carriedChannel(o.cssProperty)), stateObs: state.filter((o) => carriedChannel(o.cssProperty)),
    named: [...new Set([...base, ...state].filter((o) => !carriedChannel(o.cssProperty))
      .map((o) => `channel-unregistered: ${o.part || 'root'} ${o.cssProperty} — no token, literal or declared channel carries it; not minted`))] };
}

/** Profile convention absolute-in-containing-block: an absolutely placed element measures its insets from its containing
 *  block, the nearest ancestor that is positioned or transformed. Where that ancestor is not its parent, the element is
 *  moved in the captured tree into that ancestor, just after the child it sat under, so it is drawn in the box its insets
 *  are measured from. It stays put when an ancestor between them hides, clips, fades or filters what it draws, and when
 *  no ancestor in the captured tree is its containing block. Returns how many elements moved. */
export function liftToContainingBlock(node: CapturedNode): number {
  const s = (n: CapturedNode, k: string, d: string) => (n.style[k] ?? d).trim();
  const contains = (n: CapturedNode) => s(n, 'position', 'static') !== 'static' || ['transform', 'filter', 'perspective', 'translate', 'rotate', 'scale']
    .some((k) => s(n, k, 'none') !== 'none') || /\b(layout|paint|strict|content)\b/.test(s(n, 'contain', 'none'));
  const passes = (n: CapturedNode) => s(n, 'display', 'block') !== 'none' && s(n, 'visibility', 'visible') === 'visible' && Number(s(n, 'opacity', '1')) === 1 &&
    ['overflow-x', 'overflow-y'].every((k) => s(n, k, 'visible') === 'visible') && ['clip-path', 'mask-image', 'backdrop-filter'].every((k) => s(n, k, 'none') === 'none');
  let moved = 0;
  if (contains(node)) for (let i = 0; i < node.nodes.length; i++) {
    const k = node.nodes[i]!, lifted: CapturedNode[] = [];
    const dive = (p: CapturedNode) => { for (let j = 0; j < p.nodes.length; j++) { const n = p.nodes[j]!; if (n.t !== 'el') continue;
      if (s(n.el, 'position', 'static') === 'absolute') { lifted.push(n.el); p.nodes.splice(j--, 1); } else if (!contains(n.el) && passes(n.el)) dive(n.el); } };
    if (k.t === 'el' && !contains(k.el) && passes(k.el)) dive(k.el);
    node.nodes.splice(i + 1, 0, ...lifted.map((el) => ({ t: 'el' as const, el })));
    i += lifted.length; moved += lifted.length;
  }
  for (const k of node.nodes) if (k.t === 'el') moved += liftToContainingBlock(k.el);
  return moved;
}

/** Profile convention show-declared-component: a case's SHOW arguments as the reader passes them, naming the component its
 *  profile declaration gives that story (a story file's subcomponent, a skeleton), so the same instance is found and
 *  becomes the subject. The last declaration listing the story wins, as in the reader's map; a story none lists is shown
 *  as before. */
export function declaredShow(declarations: ReadonlyArray<{ name: string; stories: readonly string[]; subcomponent?: true }>, id: string, args: unknown): string {
  const d = [...declarations].reverse().find((x) => x.stories.includes(id));
  return JSON.stringify(d ? [id, args, d.name, !!d.subcomponent] : [id, args]);
}

/** Profile convention single-row-grid-as-row: a part that is a grid in some values of one variant axis and not in the
 *  others cannot carry the grid per value (a per-variant grid is refused, P10). Where, in every variant of such a value,
 *  the grid has one non-empty row (its first), its in-flow children are auto-placed one per column in document order,
 *  each column is as wide as its child's margin box, every other track is 0, and the grid has no padding, border or
 *  content distribution, that value draws as a row: a layoutByProp override with the grid's item alignment, and
 *  `gridAsRow` with the column gap and the extent of the empty trailing tracks. A lowering, not CSS; any other such grid
 *  is named. Returns the receipts and the refusals. */
export function lowerSingleRowGrid(contract: Contract, combos: ReadonlyArray<{ key: string; axisValues: Record<string, string> }>,
  nodeAt: (key: string, part: string) => CapturedNode | null): [string[], string[]] {
  const receipts: string[] = [], refused: string[] = [], grid = (n: CapturedNode | null) => !!n && /^(inline-)?grid$/.test(n.style['display'] ?? '');
  const px = (v: string | undefined) => v === 'normal' ? 0 : /^-?\d+(\.\d+)?px$/.test(v ?? '') ? parseFloat(v!) : NaN, list = (v?: string) => (v ?? '').split(' ').map(px);
  const ALIGN = { center: 'center', start: 'start', 'flex-start': 'start', end: 'end', 'flex-end': 'end' } as Record<string, 'center' | 'start' | 'end'>;
  const lower = (n: CapturedNode): string | Record<string, unknown> => {
    const s = n.style, kids = n.nodes.flatMap((k) => k.t === 'el' && !/absolute|fixed/.test(k.el.style['position'] ?? '') && k.el.style['display'] !== 'none' ? [k.el] : []);
    const rows = list(s['grid-template-rows']), cols = list(s['grid-template-columns']), gap = px(s['column-gap']), rowGap = px(s['row-gap']);
    const outer = (k: CapturedNode) => ['width', 'margin-left', 'margin-right', ...(k.style['box-sizing'] === 'content-box' ? ['padding-left', 'padding-right', 'border-left-width', 'border-right-width'] : [])].reduce((t, c) => t + px(k.style[c]), 0);
    if (n.nodes.some((k) => k.t === 'text' && k.v.trim())) return 'text-in-grid';
    if ([...rows, ...cols, gap, rowGap].some(Number.isNaN) || s['grid-template-areas'] !== 'none' || s['grid-auto-flow'] !== 'row') return 'tracks-not-px-row-flow';
    if (kids.some((k) => ['grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end'].some((c) => k.style[c] !== 'auto'))) return 'child-placed';
    if (!(rows[0]! > 0) || rows.slice(1).some((r) => r !== 0)) return 'not-one-row';
    if (kids.length > cols.length || kids.some((k, i) => Math.abs(outer(k) - cols[i]!) > 0.01) || cols.slice(kids.length).some((c) => c !== 0)) return 'columns-not-children';
    if (['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'].some((c) => px(s[c]) !== 0)) return 'grid-box-padded';
    if (!['normal', 'start', 'flex-start'].includes(s['justify-content'] ?? 'normal') || !['normal', 'start', 'flex-start'].includes(s['align-content'] ?? 'normal') || !ALIGN[s['align-items'] ?? '']) return 'alignment-unmapped';
    const right = (cols.length - kids.length) * gap, bottom = (rows.length - 1) * rowGap;
    return { display: s['display'] === 'inline-grid' ? 'inline-flex' : 'flex', direction: 'row', align: ALIGN[s['align-items']!],
      gridAsRow: { gap, ...(right ? { paddingRight: right } : {}), ...(bottom ? { paddingBottom: bottom } : {}) } };
  };
  const visit = (name: string, part: Part) => {
    for (const [k, p] of Object.entries(part.parts ?? {})) visit(k, p as Part);
    const seen = combos.map((k) => [k, nodeAt(k.key, name)] as const).filter((x): x is readonly [typeof x[0], CapturedNode] => !!x[1]);
    if (!seen.some(([, n]) => grid(n)) || seen.every(([, n]) => grid(n))) return;
    const axis = contract.props.find((p) => Array.isArray((p as { type?: { enum?: unknown } }).type?.enum) &&
      seen.every(([k, n]) => seen.every(([o, m]) => o.axisValues[p.name] !== k.axisValues[p.name] || grid(n) === grid(m))))?.name;
    const map: Record<string, unknown> = {}, why: string[] = [];
    for (const [k, n] of seen) if (axis && grid(n)) {
      const v = k.axisValues[axis]!, l = lower(n), was = map[v];
      if (typeof l === 'string') why.push(l); else if (was !== undefined && JSON.stringify(was) !== JSON.stringify(l)) why.push('differs-across-variants'); else map[v] = l;
    }
    if (!axis || why.length || part.layout || part.layoutByProp || part.layoutByCombination)
      return void refused.push(`grid-row-unlowered: ${name}: ${!axis ? 'not-by-one-axis' : why.length ? [...new Set(why)].join(',') : 'part-has-layout'}`);
    part.layoutByProp = { prop: axis, map } as Part['layoutByProp'];
    receipts.push(`grid-lowered-to-row: ${name}: ${axis}=${Object.keys(map).join('|')}`);
  };
  visit('root', contract.anatomy.root as Part);
  return [receipts, refused];
}

/** Profile convention align-self-center-in-stretched-box: a child of a flex parent that the browser centers on the parent's
 *  cross axis (align-self: center), in flow, carries alignSelf: center, in every variant it is drawn in or per value of the
 *  one enum axis that decides it. Anything else is named (align-self-center-uncarried). Returns [receipts, refusals]. */
export function carryAlignSelfCenter(contract: Contract, combos: ReadonlyArray<{ key: string; axisValues: Record<string, string> }>,
  nodeAt: (key: string, part: string) => CapturedNode | null): [string[], string[]] {
  const receipts: string[] = [], refused: string[] = [], centered = (n: CapturedNode) => n.style['align-self'] === 'center';
  const visit = (name: string, part: Part, parent: string | null) => {
    for (const [k, p] of Object.entries(part.parts ?? {})) visit(k, p as Part, name);
    const seen = parent === null ? [] : combos.flatMap((k) => { const n = nodeAt(k.key, name); return n && n.style['display'] !== 'none' ? [[k, n, nodeAt(k.key, parent)] as const] : []; });
    if (!seen.some(([, n]) => centered(n))) return;
    const why = seen.some(([, n, up]) => centered(n) && (!up || !/^(inline-)?flex$/.test(up.style['display'] ?? '') || /absolute|fixed/.test(n.style['position'] ?? ''))) ? 'not-an-in-flow-flex-child'
      : part.layoutByCombination || part.layout?.alignSelf ? 'part-has-layout-table' : '';
    const axis = seen.every(([, n]) => centered(n)) ? null : contract.props.find((p) => Array.isArray((p as { type?: { enum?: unknown } }).type?.enum) &&
      seen.every(([k, n]) => seen.every(([o, m]) => o.axisValues[p.name] !== k.axisValues[p.name] || centered(n) === centered(m))))?.name;
    if (why || axis === undefined || (axis && part.layoutByProp && part.layoutByProp.prop !== axis))
      return void refused.push(`align-self-center-uncarried: ${name}: ${why || (axis === undefined ? 'not-by-one-axis' : 'part-has-layout-table')}`);
    if (axis === null) { part.layout = { ...part.layout, alignSelf: 'center' }; return void receipts.push(`align-self-center-carried: ${name}: every variant`); }
    const map: Record<string, Record<string, unknown>> = { ...(part.layoutByProp?.map as Record<string, Record<string, unknown>> | undefined) };
    for (const [k, n] of seen) if (centered(n)) map[k.axisValues[axis]!] = { ...map[k.axisValues[axis]!], alignSelf: 'center' };
    part.layoutByProp = { prop: axis, map } as Part['layoutByProp'];
    receipts.push(`align-self-center-carried: ${name}: ${axis}=${Object.keys(map).filter((v) => map[v]!.alignSelf === 'center').join('|')}`);
  };
  visit('root', contract.anatomy.root as Part, null);
  return [receipts, refused];
}

/** Profile convention svg-own-fill-on-host: an element holding nothing but one svg, whose own fill (a rule on the svg, not
 *  one it inherits from the element) differs from the element's, takes that fill as its own. The svg folds into the
 *  element as its icon, and its shapes' fill is read as the host's, so the glyph keeps the fill the browser drew; CSS fill
 *  inherits, so the svg still draws the same. Returns the elements changed. */
export function liftSvgOwnFill(node: CapturedNode): number {
  const kids = node.nodes.flatMap((k) => k.t === 'el' ? [k.el] : []), svg = kids.length === 1 && kids[0]!.tag === 'svg' ? kids[0]! : null;
  const alone = !node.nodes.some((k) => k.t === 'text' && k.v.trim()), fill = svg?.style['fill'];
  let n = 0;
  if (svg && alone && fill && fill !== node.style['fill'] && /^(rgb|#)/.test(fill)) { node.style['fill'] = fill; n++; }
  for (const k of kids) n += liftSvgOwnFill(k);
  return n;
}

/** Profile convention generated-text-carried, the page half: each element under the captured root, in the capture's
 *  order, is numbered (`data-ds-generated`, removed again with `clear`) so the layout snapshot can name the element each
 *  ::marker, ::before and ::after belongs to. Returns the elements' tags, which the capture must match. */
export const NUMBER_ELEMENTS = (rootPath: readonly string[] | undefined, clear = false) => `(() => { ${SHADOW_HELPERS_JS}
  const root = ${rootPath ? `document.querySelector(${JSON.stringify(rootPath[0])})` : `shStageRoot(document.querySelector('[data-ds-reader-cell]'))`}, tags = [];
  const walk = (el) => { if (${clear}) el.removeAttribute('data-ds-generated'); else el.setAttribute('data-ds-generated', String(tags.length)); tags.push(el.localName);
    for (const c of shChildNodesOf(el)) if (c.nodeType === 1 && !(c instanceof SVGElement && ['title', 'desc', 'metadata'].includes(c.localName))) walk(c); };
  if (root) walk(root); return tags; })()`;

/** Convention text-baseline-as-drawn: for each element in capture order (NUMBER_ELEMENTS' walk), where Chromium laid out
 *  the baseline of its own text, in px below that line box's top, when that text is one line in a block-level or inline
 *  box (zero-size probes at the line top before its first run and after its last, and at the baseline; removed at once),
 *  with its font's ascent and descent per em (canvas, at 1000 px); null otherwise. */
/** Convention text-baseline-as-painted: Chromium paints a line at its laid-out baseline rounded half up to the whole
 *  pixel; with the subject on a whole pixel, as the reader draws it, that is this px below the line top. */
export const paintedPx = (rel: number, px: number): number => Math.floor(rel + px + 0.5) - rel;
/** rootFlex (convention root-text-baseline-as-drawn): the captured root's own one-line text in a flex or grid container is
 *  read too. Its text is an anonymous item there, so it is wrapped in a span for the probes, read only if the wrap leaves the
 *  text's box where it was, and unwrapped at once. */
export const MEASURE_BASELINES = (rootPath: readonly string[] | undefined, painted = false, rootFlex = false) => `(() => { ${SHADOW_HELPERS_JS}
  const root = ${rootPath ? `document.querySelector(${JSON.stringify(rootPath[0])})` : `shStageRoot(document.querySelector('[data-ds-reader-cell]'))`}, out = [];
  const probe = (align) => { const p = document.createElement('span'); p.style.cssText = 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:' + align; return p; };
  const walk = (el) => { const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.data.trim()), cs = getComputedStyle(el); let m = null;
    if (own.length && /^(block|inline|inline-block|list-item|flow-root|table-cell)$/.test(cs.display)) {
      const first = probe('top'), last = probe('top'), base = probe('baseline'); own[0].before(first); own[0].after(base); own[own.length - 1].after(last);
      const top = first.getBoundingClientRect().top, one = top === last.getBoundingClientRect().top, b = base.getBoundingClientRect().top - top;
      first.remove(); base.remove(); last.remove();
      const c = document.createElement('canvas').getContext('2d'); c.font = cs.fontStyle + ' ' + cs.fontWeight + ' 1000px ' + cs.fontFamily; const f = c.measureText('H');
      if (one) m = { px: +${painted ? `((${paintedPx.toString()})(top - root.getBoundingClientRect().top, b))` : 'b'}.toFixed(4), ascent: +(f.fontBoundingBoxAscent / 1000).toFixed(4), descent: +(f.fontBoundingBoxDescent / 1000).toFixed(4) }; }
${rootFlex ? `    if (!m && el === root && own.length === 1 && /^(inline-)?(flex|grid)$/.test(cs.display)) {
      const t = own[0], box = () => { const g = document.createRange(); g.selectNodeContents(t); const r = g.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }, was = box(), s = document.createElement('span');
      t.before(s); s.appendChild(t);
      if (box().every((v, i) => Math.abs(v - was[i]) < 0.01)) { const first = probe('top'), last = probe('top'), base = probe('baseline'); t.before(first); t.after(base); base.after(last);
        const top = first.getBoundingClientRect().top, one = top === last.getBoundingClientRect().top, b = base.getBoundingClientRect().top - top;
        first.remove(); base.remove(); last.remove();
        const c = document.createElement('canvas').getContext('2d'); c.font = cs.fontStyle + ' ' + cs.fontWeight + ' 1000px ' + cs.fontFamily; const f = c.measureText('H');
        if (one) m = { px: +${painted ? `((${paintedPx.toString()})(top - root.getBoundingClientRect().top, b))` : 'b'}.toFixed(4), ascent: +(f.fontBoundingBoxAscent / 1000).toFixed(4), descent: +(f.fontBoundingBoxDescent / 1000).toFixed(4) }; }
      s.before(t); s.remove(); }
` : ''}    out.push([el.localName, m]);
    for (const c of shChildNodesOf(el)) if (c.nodeType === 1 && !(c instanceof SVGElement && ['title', 'desc', 'metadata'].includes(c.localName))) walk(c); };
  if (root) walk(root); return out; })()`;

/** The captured elements, in capture order, matched to MEASURE_BASELINES' readings by position and tag; none if they differ. */
export function drawnBaselines<T = { px: number; ascent: number; descent: number }>(root: CapturedNode, read: ReadonlyArray<[string, T | null]>): Map<CapturedNode, T | null> | null {
  const els: CapturedNode[] = [], walk = (n: CapturedNode) => { els.push(n); for (const k of n.nodes) if (k.t === 'el') walk(k.el); };
  walk(root);
  if (els.length !== read.length || els.some((e, i) => e.tag.toLowerCase() !== read[i]![0].toLowerCase())) return null;
  return new Map(els.map((e, i) => [e, read[i]![1]]));
}

/** A per-variant table's rows: each drawn variant's reading, keyed by the axes that tell the readings apart (the most
 *  decisive first, then kept in axis order; none when every variant agrees). */
function variantRows<T extends object>(axes: readonly string[], drawn: ReadonlyArray<{ v: Record<string, string>; m: T }>): { props: string[]; rows: Array<{ values: string[] } & T> } {
  const clash = (props: string[]) => { const seen = new Map<string, string>(); let n = 0;
    for (const r of drawn) { const k = JSON.stringify(props.map((a) => r.v[a])), m = JSON.stringify(r.m); if (seen.has(k) && seen.get(k) !== m) n++; seen.set(k, m); } return n; };
  const props: string[] = [];
  while (clash(props) && props.length < axes.length) props.push(axes.filter((a) => !props.includes(a)).sort((a, b) => clash([...props, a]) - clash([...props, b]))[0]!);
  props.sort((a, b) => axes.indexOf(a) - axes.indexOf(b));
  return { props, rows: [...new Map(drawn.map((r) => { const values = props.map((a) => r.v[a]!); return [JSON.stringify(values), { values, ...r.m }]; })).values()] };
}

/** Convention inline-block-line-box-as-drawn: a part that sits alone on its line as an atomic inline in some variant carries
 *  the line box measured in every variant that draws it (`lineBox`; a variant whose box is not on such a line reads 0, 0).
 *  Returns the parts carried. */
export function carryLineBox(contract: Contract, axes: readonly string[], combos: ReadonlyArray<{ key: string; axisValues: Record<string, string> }>,
  at: (comboKey: string, part: string) => { top: number; bottom: number } | null | undefined): string[] {
  const carried: string[] = [];
  const visit = (parts: Record<string, Part> | undefined) => { for (const [name, part] of Object.entries(parts ?? {})) {
    const drawn = combos.flatMap((k) => { const m = at(k.key, name); return m === undefined ? [] : [{ v: k.axisValues, m: m ?? { top: 0, bottom: 0 } }]; });
    if (drawn.some((r) => r.m.top || r.m.bottom)) {
      part.lineBox = variantRows(axes, drawn);
      if (lineBoxIssues(contract, part, true).length) delete part.lineBox; else carried.push(name);
    }
    visit(part.parts as Record<string, Part> | undefined);
  } };
  visit(contract.anatomy.root.parts as Record<string, Part> | undefined);
  return carried;
}

/** Convention text-baseline-as-drawn: a part owning one line of literal text carries the baseline the browser drew in each
 *  variant that draws it (`textBaseline`, over the axes that tell the readings apart; none when all agree). A part that
 *  some drawing variant has no reading for (two lines, a flex or grid box) is left as it was. Returns the parts carried. */
export function carryTextBaseline(contract: Contract, axes: readonly string[], combos: ReadonlyArray<{ key: string; axisValues: Record<string, string> }>,
  at: (comboKey: string, part: string) => { px: number; ascent: number; descent: number } | null | undefined, withRoot = false): string[] {
  const carried: string[] = [];
  const visit = (parts: Record<string, Part> | undefined) => { for (const [name, part] of Object.entries(parts ?? {})) {
    const drawn = typeof part.text === 'string' ? combos.flatMap((k) => { const m = at(k.key, name); return m === undefined ? [] : [{ v: k.axisValues, m }]; }) : [];
    if (drawn.length && drawn.every((r) => r.m)) {
      part.textBaseline = variantRows(axes, drawn as Array<{ v: Record<string, string>; m: { px: number; ascent: number; descent: number } }>);
      if (textBaselineIssues(contract, part).length) delete part.textBaseline; else carried.push(name);
    }
    visit(part.parts as Record<string, Part> | undefined);
  } };
  // Convention root-text-baseline-as-drawn: the root's own text too, read as the part named root.
  visit((withRoot ? { root: contract.anatomy.root } : contract.anatomy.root.parts) as Record<string, Part> | undefined);
  return carried;
}

/** Convention inline-block-line-box-as-drawn: for each element in capture order (NUMBER_ELEMENTS' walk), how far the line
 *  box it sits alone on reaches above its margin box and below it, in px, when it is an atomic inline in a block container
 *  whose nearest in-flow neighbours are blocks or none (zero-size probes at the line's top and bottom, removed at once);
 *  null otherwise, or when the line box is its margin box. */
export const MEASURE_LINE_BOXES = (rootPath: readonly string[] | undefined) => `(() => { ${SHADOW_HELPERS_JS}
  const root = ${rootPath ? `document.querySelector(${JSON.stringify(rootPath[0])})` : `shStageRoot(document.querySelector('[data-ds-reader-cell]'))`}, out = [];
  const probe = (align) => { const p = document.createElement('span'); p.style.cssText = 'display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:' + align; return p; };
  const flows = (n) => n.nodeType === 3 ? n.data.trim() !== '' : n.nodeType === 1 && getComputedStyle(n).display !== 'none' && !['absolute', 'fixed'].includes(getComputedStyle(n).position);
  const block = (n) => !n || (n.nodeType === 1 && !/^inline/.test(getComputedStyle(n).display));
  const walk = (el) => { const cs = getComputedStyle(el), up = el.parentElement; let m = null;
    if (el !== root && up && /^inline-(block|flex|grid|table)$/.test(cs.display) && cs.position !== 'absolute' && cs.position !== 'fixed' && cs.float === 'none' &&
      /^(block|list-item|flow-root|inline-block|table-cell)$/.test(getComputedStyle(up).display)) {
      const flow = [...up.childNodes].filter(flows), i = flow.indexOf(el);
      if (block(flow[i - 1]) && block(flow[i + 1])) {
        const t = probe('top'), b = probe('bottom'); el.before(t); el.after(b);
        const r = el.getBoundingClientRect(), above = r.top - parseFloat(cs.marginTop) - t.getBoundingClientRect().top, below = b.getBoundingClientRect().bottom - r.bottom - parseFloat(cs.marginBottom);
        t.remove(); b.remove();
        if (above > 0.001 || below > 0.001) m = { top: +Math.max(0, above).toFixed(4), bottom: +Math.max(0, below).toFixed(4) }; } }
    out.push([el.localName, m]);
    for (const c of shChildNodesOf(el)) if (c.nodeType === 1 && !(c instanceof SVGElement && ['title', 'desc', 'metadata'].includes(c.localName))) walk(c); };
  if (root) walk(root); return out; })()`;

export type GeneratedText = { pe: '::marker' | '::before' | '::after'; text: string; x: number; y: number };
/** What each numbered element's ::marker, ::before and ::after draws, read from Chromium's layout snapshot (the computed
 *  `content` keeps counter() unresolved; the layout holds the text drawn), at the left of its first glyph and the top of
 *  its own box; and each numbered element's border-box origin. Page coordinates throughout. */
export async function generatedText(cdp: CDPSession): Promise<{ texts: Map<number, GeneratedText[]>; boxes: Map<number, number[]> }> {
  const { documents, strings: s } = await cdp.send('DOMSnapshot.captureSnapshot', { computedStyles: [] });
  const texts = new Map<number, GeneratedText[]>(), boxes = new Map<number, number[]>();
  for (const { nodes: n, layout: l } of documents) {
    const box = new Map<number, number[]>(), runs = new Map<number, Array<[string, number[]]>>();
    l.nodeIndex.forEach((i, k) => { if (l.text[k]! >= 0) runs.set(i, [...runs.get(i) ?? [], [s[l.text[k]!]!, l.bounds[k]!]]); else if (!box.has(i)) box.set(i, l.bounds[k]!); });
    const numberOf = (i: number) => { const a = n.attributes?.[i] ?? []; for (let k = 0; k < a.length; k += 2) if (s[a[k]!] === 'data-ds-generated') return Number(s[a[k + 1]!]); };
    box.forEach((b, i) => { const at = numberOf(i); if (at !== undefined) boxes.set(at, b); });
    n.pseudoType?.index.forEach((i, k) => {
      const pe = `::${s[n.pseudoType!.value[k]!]}` as GeneratedText['pe'], at = numberOf(n.parentIndex![i]!), r = runs.get(i);
      if (!['::marker', '::before', '::after'].includes(pe) || at === undefined || !r) return;
      texts.set(at, [...texts.get(at) ?? [], { pe, text: r.map(([t]) => t).join(''), x: Math.min(...r.map(([, b]) => b[0]!)), y: (box.get(i) ?? r[0]![1])[1]! }]);
    });
  }
  return { texts, boxes };
}

/** Profile convention generated-text-carried: the text a ::marker, ::before or ::after draws (a list's numbers and
 *  bullets) becomes a span in its element (first, or last for ::after), placed absolutely where the page drew it and
 *  styled as the pseudo-element computes, with no margin or padding. Only text the layout holds is carried; `content`
 *  is never evaluated here. A pseudo-element that paints a box (background, border or shadow), one whose content or list
 *  marker is an image (url(), a gradient, image-set()), one that draws only spaces and one with no text in the layout
 *  stay as they are, refused by name as when the convention is off (`pseudo-content-not-canvas-ink`). The page's elements are matched to the capture as read; the returned function adds
 *  the spans (after any pass that moves elements). Null, and nothing carried, when the page's elements and the capture's
 *  differ. */
export function carryGeneratedText(root: CapturedNode, tags: readonly string[], drawn: Awaited<ReturnType<typeof generatedText>>,
  placed: (host: CapturedNode, span: CapturedNode) => void = () => {}): (() => void) | null {
  const els: CapturedNode[] = [], walk = (n: CapturedNode) => { els.push(n); for (const k of n.nodes) if (k.t === 'el') walk(k.el); };
  walk(root);
  if (els.length !== tags.length || els.some((e, i) => e.tag.toLowerCase() !== tags[i]!.toLowerCase())) return null;
  const image = /\b(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(/;
  const adds: Array<() => void> = [], order = ['::marker', '::before', '::after'], sides = ['top', 'right', 'bottom', 'left'], px = (v: string | undefined) => Number.parseFloat(v ?? '') || 0;
  const paints = (st: Record<string, string>) => !/^(transparent|rgba\(\d+, \d+, \d+, 0\))$/.test(st['background-color'] ?? 'transparent') ||
    (st['background-image'] ?? 'none') !== 'none' || (st['box-shadow'] ?? 'none') !== 'none' || sides.some((s) => px(st[`border-${s}-width`]) > 0 && (st[`border-${s}-style`] ?? 'none') !== 'none');
  els.forEach((host, i) => {
    let lead = 0;
    const origin = drawn.boxes.get(i);
    for (const g of [...drawn.texts.get(i) ?? []].sort((a, b) => order.indexOf(a.pe) - order.indexOf(b.pe))) {
      const st = host.pseudo[g.pe];
      if (!st || !origin || !g.text.trim() || paints(st) || image.test(st['content'] ?? '') || image.test(st['list-style-image'] ?? '')) continue;
      const style = { ...st, display: 'block', position: 'absolute', left: `${g.x - origin[0]! - px(host.style['border-left-width'])}px`,
        top: `${g.y - origin[1]! - px(host.style['border-top-width'])}px`, ...Object.fromEntries(['margin', 'padding'].flatMap((b) => sides.map((s) => [`${b}-${s}`, '0px']))) };
      const span: CapturedNode = { tag: 'span', classes: [], nodes: [{ t: 'text', v: g.text }], style, pseudo: {} }, at = g.pe === '::after' ? -1 : lead++;
      adds.push(() => { host.nodes.splice(at < 0 ? host.nodes.length : at, 0, { t: 'el', el: span }); delete host.pseudo[g.pe]; placed(host, span); });
    }
  });
  return () => adds.forEach((add) => add());
}

/** Profile convention closed-select-draws-selected-label: a select part the capture read as a closed single select (`label`
 * gives its selected option's label, null otherwise) takes that label as its text, when it draws one, and drops its option
 * and optgroup parts, which a closed select never draws. Returns the parts it changed. */
export function closedSelectLabels(contract: Contract, label: (part: string) => string | null): string[] {
  const changed: string[] = [];
  const visit = (parts: Record<string, Part> | undefined) => { for (const [name, part] of Object.entries(parts ?? {})) {
    const drawn = part.element === 'select' ? label(name) : null;
    if (drawn !== null) {
      for (const [k, child] of Object.entries(part.parts ?? {})) if (child.element === 'option' || child.element === 'optgroup') delete part.parts![k];
      if (part.parts && !Object.keys(part.parts).length) delete part.parts;
      if (drawn) part.text = drawn;
      changed.push(name);
    }
    visit(part.parts as Record<string, Part> | undefined);
  } };
  visit(contract.anatomy.root.parts as Record<string, Part> | undefined);
  return changed;
}

/** The harness's sizing evidence (extract/computed/run.ts, task #37) for the root, on this route too: a root carrying
 * max-width that the capture measured hugging beneath it in every combo (`hugs`, from fuse's hugEvidence) marks
 * `hugsBelowMaxWidth`, so the writer binds the cap as a ceiling instead of baking it as the root's fixed width (a part's
 * max-width is a ceiling already). No measurement, or a root at its cap, changes nothing. */
export function carryRootHugEvidence(contract: Contract, hugs: ReadonlyMap<string, boolean>): boolean {
  const root = contract.anatomy.root;
  if (![root.tokens, root.declared, root.literals].some((m) => m && 'max-width' in m) || hugs.get('root') !== true) return false;
  root.hugsBelowMaxWidth = true;
  return true;
}

/** The engine conventions the system's profile switches on (GOAL.md, 2026-11-09), from the profile the reader recorded,
 * refused by name if its bytes changed since the reader read it; none when the reader recorded no profile. */
export function profileConventions(stories: Pick<ReaderOutput, 'profile'>, read: (file: string) => Buffer = (file) => readFileSync(file)) {
  if (!stories.profile) return conventionSet([]);
  const bytes = read(stories.profile.path);
  if (createHash('sha256').update(bytes).digest('hex') !== stories.profile.sha256) throw Error(`profile-changed-since-read:${stories.profile.path}`);
  return conventionSet((JSON.parse(bytes.toString()) as { conventions?: string[] }).conventions);
}

/** The class prefix the profile's own capture config names (`setup.captureConfig`, `library.classPrefix`), else ''. */
export function profileClassPrefix(stories: Pick<ReaderOutput, 'profile'>, read: (file: string) => string = (file) => readFileSync(file, 'utf8')): string {
  const config = stories.profile && (JSON.parse(read(stories.profile.path)) as { setup?: { captureConfig?: string } }).setup?.captureConfig;
  return config ? String((JSON.parse(read(config)) as { library?: { classPrefix?: string } }).library?.classPrefix ?? '') : '';
}

/** Whether aligning by position left a variant's own text on a part whose base element draws none: two different
 *  elements in one slot (a wrapper in one variant, a label in the others), so that text reaches no contract. */
export function textLostByPosition(aligned: { getAligned: (key: string) => Array<{ node: CapturedNode } | null> }, base: string, keys: readonly string[]): boolean {
  const own = (n: CapturedNode | undefined) => !!n?.nodes.some((c) => c.t === 'text' && c.v.trim());
  return aligned.getAligned(`${base}__default`).some((el, i) => !!el && !own(el.node) && keys.some((k) => own(aligned.getAligned(`${k}__default`)[i]?.node)));
}

/** Classes that name an element. Emotion's generated `css-<hash>` names hash the styles (a random blob URL in one gives
 * a new name every run), so they never identify a part; every other class does, as before. */
const IDENTITY_CLASSES = '^(?!css-[0-9a-z]+(-|$))';
const IMAGES_SETTLED = `Promise.race([Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => {
  i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); }))).then(() => new Promise((r) =>
  requestAnimationFrame(() => requestAnimationFrame(() => r(true))))), new Promise((r) => setTimeout(() => r(false), 20000))])`;
const pascal = (t: string) => t.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ?? '').toUpperCase()).replace(/^./, (c) => c.toUpperCase());
/** A component's name: its title's last segment, with as many parent segments as it takes to differ from every other
 * declared component's (A0 has two titles ending in Calendar, which wrote one contract over the other). */
const uniqueName = (title: string, titles: readonly string[]) => {
  const tail = (t: string, k: number) => pascal(t.split('/').slice(-k).join(' '));
  for (let k = 1; ; k++) if (k >= title.split('/').length || titles.filter((t) => tail(t, k) === tail(title, k)).length === 1) return tail(title, k);
};
const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** `ds-contracts.react.json`: one case per variant the matrix rule counts, in the reader's order. */
export function declare(stories: ReaderOutput, storybook = stories.storybook): StoryDeclaration {
  const components: DeclaredComponent[] = [], refused: StoryDeclaration['refused'] = [];
  for (const c of stories.components) {
    if (c.grammar.grammar !== 'in') { refused.push({ subject: c.title, reason: `grammar-out:${c.grammar.reasons.join(',')}` }); continue; }
    if (c.matrix.status !== 'ok') { refused.push({ subject: c.title, reason: `story-matrix-refused:${c.matrix.reason}` }); continue; }
    if (!c.references.length) { refused.push({ subject: c.title, reason: 'no-variant' }); continue; }
    const seen = new Map<string, number>();
    const cases = c.references.map((r) => { const n = seen.get(r.storyId) ?? 0; seen.set(r.storyId, n + 1);
      return { id: `${r.storyId}.${n}`, story: { id: r.storyId, args: r.args, ...(typeof r.instance === 'number' ? { instance: r.instance } : {}) }, variant: r.variant }; });
    components.push({ subject: c.title, name: '', axes: [...c.matrix.axes], cases });
  }
  for (const c of components) c.name = uniqueName(c.subject, components.map((x) => x.subject));
  return { version: 2, source: 'storybook', storybook, react: stories.environment?.react ?? null, components, refused };
}

/** The seed contract: props and axes only, from the matrix; the anatomy is promoted from the observed DOM. The
 * matrix's option names are the Figma option names (an unset argument shows `(default)`). Enum values must also name
 * minted tokens, so each takes a token-safe slug and the prop's VARIANT binding maps it back. */
export function seed(c: DeclaredComponent) {
  const values = (a: string) => [...new Set(c.cases.map((k) => k.variant[a]!))];
  const slugs = new Map(c.axes.map((a) => { const used = new Set<string>();
    return [a, new Map(values(a).map((v) => { const s0 = v.replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'value';
      let s = s0; for (let k = 2; used.has(s); k++) s = `${s0}-${k}`; used.add(s); return [v, s] as const; }))] as const; }));
  const slug = (a: string, v: string) => slugs.get(a)!.get(v)!, first = c.cases[0]!.variant;
  const contract = ContractSchema.parse({ id: `storybook.${kebab(c.name)}`, name: c.name, version: '0.1.0', status: 'draft',
    description: `From Storybook: ${c.subject}`, semantics: { element: 'div' }, states: [], anatomy: { root: {} },
    props: c.axes.map((a) => ({ name: a, type: { enum: values(a).map((v) => slug(a, v)) }, default: slug(a, first[a]!),
      bindings: { figma: { kind: 'VARIANT', property: a, values: Object.fromEntries(values(a).map((v) => [slug(a, v), v])) }, code: { prop: a } } })),
    bindings: { figma: { anchors: { fileKey: null, componentSetKey: null } }, code: { anchors: { importPath: 'storybook', export: c.name } } } }) as Contract;
  const tuple = (k: StoryCase) => Object.fromEntries(c.axes.map((a) => [a, slug(a, k.variant[a]!)]));
  const position = (t: Record<string, string>) => c.axes.map((a) => values(a).map((v) => slug(a, v)).indexOf(t[a]!));
  const drawn = c.cases.map(tuple).sort((x, y) => { const p = position(x), q = position(y), i = p.findIndex((v, k) => v !== q[k]); return i < 0 ? 0 : p[i]! - q[i]!; });
  const axes: EnumAxisSpec[] = c.axes.map((a) => ({ prop: a, values: values(a).map((v) => slug(a, v)) }));
  const combos = c.cases.map((k) => ({ key: comboKey(axes, [], tuple(k), {}), axisValues: tuple(k), stateFlags: {} }));
  const space: PropSpace = { contract, axes, presence: new Map(), stateProps: [],
    enumeration: { policy: 'full-cartesian', cartesianSize: axes.reduce((n, a) => n * a.values.length, 1), combos, receipts: [] },
    baseComboKey: combos[0]!.key, baseAxisValues: combos[0]!.axisValues, heldFixed: [] };
  return { contract, drawn, combos, space };
}

/** Each variant's own text (GOAL.md Step 2: a full default plus per-variant differences). A nested part whose literal
 * text differs between variants carries the text each variant drew (`textByCombination`, over the variant axes). A table
 * the schema refuses (a root part, a domain that does not match where the part is drawn) leaves the first variant's
 * text and is named. A text field's text is an attribute, read as the reader reads it: its value, else its placeholder.
 * A placeholder every variant without a value draws alike is the field's `attrs.placeholder`; values are carried per
 * variant like literal text ('' where the field draws none). */
export function carryVariantText(contract: Contract, axes: readonly string[], combos: ReadonlyArray<{ key: string; axisValues: Record<string, string> }>,
  textAt: (comboKey: string, part: string) => string | null, fieldAt: (comboKey: string, part: string) => { value: string; placeholder: string } | null = () => null,
  rootTextByAxis = false, textOwnsPart = false, fieldValueWithoutAxes = false): string[] {
  const refused: string[] = [], names = new Set<string>();
  const named = (parts: Record<string, Part> | undefined): void => { for (const [n, p] of Object.entries(parts ?? {})) { names.add(n); named(p.parts as never); } };
  named(contract.anatomy.root.parts as Record<string, Part> | undefined);
  const visit = (parts: Record<string, Part> | undefined) => { for (const [name, part] of Object.entries(parts ?? {})) {
    const field = (part.element === 'input' || part.element === 'textarea') && part.text === undefined;
    const fields = field ? combos.flatMap((k) => { const f = fieldAt(k.key, name); return f ? [{ v: k.axisValues, ...f }] : []; }) : [];
    const holders = [...new Set(fields.filter((f) => !f.value).map((f) => f.placeholder))];
    if (holders.length === 1 && holders[0] && part.attrs?.placeholder === undefined) part.attrs = { ...part.attrs, placeholder: holders[0] };
    else if (holders.length > 1) refused.push(`field-placeholder-per-variant: ${name}`);
    // Convention field-value-without-axes: a field that draws one value in every variant (a set with no axes too) carries
    // it as a table with no props. Off, such a field is refused when it has axes and skipped when it has none.
    if ((axes.length || (fieldValueWithoutAxes && field)) && (typeof part.text === 'string' || field)) {
      const drawn = field ? fields.map((f) => ({ v: f.v, text: f.value }))
        : combos.flatMap((k) => { const text = textAt(k.key, name); return text === null ? [] : [{ v: k.axisValues, text }]; });
      if (field ? drawn.some((r) => r.text) : new Set(drawn.map((r) => r.text)).size > 1) {
        // Axes that tell the texts apart (a table names at most 8), added most decisive first, kept in axis order.
        const clash = (props: string[]) => { const seen = new Map<string, string>(); let n = 0;
          for (const r of drawn) { const k = JSON.stringify(props.map((a) => r.v[a])); if (seen.has(k) && seen.get(k) !== r.text) n++; seen.set(k, r.text); } return n; };
        const props: string[] = [];
        while (clash(props) && props.length < axes.length) props.push(axes.filter((a) => !props.includes(a)).sort((a, b) => clash([...props, a]) - clash([...props, b]))[0]!);
        props.sort((a, b) => axes.indexOf(a) - axes.indexOf(b));
        const rows = [...new Map(drawn.map((r) => { const values = props.map((a) => r.v[a]!); return [JSON.stringify(values), { values, text: r.text }]; })).values()];
        part.textByCombination = { props, rows };
        let issues = props.length || fieldValueWithoutAxes ? textByCombinationIssues(contract, part, true) : ['literal-text-combination-invalid'];
        // Convention variant-text-owns-its-part: a part whose own text varies, refused only because it also holds child
        // parts, gives that text to a new first child part (an inline run, as CSS draws it ahead of the children), which
        // owns the literal and inherits the part's text style. Off, or when that child is refused too, it stays refused.
        const plain = ['content', 'textByProp', 'component', 'slot', 'repeat', 'icon', 'shape', 'mask', 'visibilityOverrideProp'].every((k) => (part as Record<string, unknown>)[k] === undefined);
        if (textOwnsPart && !field && plain && issues.join() === 'literal-text-combination-requires-owned-literal' && Object.keys(part.parts ?? {}).length) {
          let child = `${name}-text`;
          while (names.has(child)) child += '-run';
          const run = { text: part.text, textByCombination: part.textByCombination, declared: { display: 'inline' } } as Part, rest = part.parts, text = part.text;
          part.parts = { [child]: run, ...rest }; delete part.text; delete part.textByCombination;
          issues = textByCombinationIssues(contract, run, true);
          if (issues.length) { part.parts = rest; part.text = text; } else names.add(child);
        }
        if (issues.length) { delete part.textByCombination; refused.push(`per-variant-text-unqualified: ${name}: ${issues.join(',')}`); }
      }
    }
    visit(part.parts as Record<string, Part> | undefined);
  } };
  visit(contract.anatomy.root.parts as Record<string, Part> | undefined);
  // Convention root-text-by-axis: the root's own literal text, where variants differ, is carried per value of the one
  // axis that decides it (`textByProp`, which the writer and the React emitter read on a root). One that some variant
  // does not draw, or that no single axis decides, is named. Off, the root keeps the first variant's text.
  const root = contract.anatomy.root as Part;
  if (rootTextByAxis && axes.length && typeof root.text === 'string' && !root.textByProp && !root.content) {
    const drawn = combos.flatMap((k) => { const text = textAt(k.key, 'root'); return text === null ? [] : [{ v: k.axisValues, text }]; });
    if (new Set(drawn.map((r) => r.text)).size > 1) {
      const decides = axes.find((a) => drawn.every((r) => drawn.every((o) => o.v[a] !== r.v[a] || o.text === r.text)));
      if (drawn.some((r) => !r.text)) refused.push('per-variant-text-unqualified: root: not-drawn-in-every-variant');
      else if (decides) root.textByProp = { prop: decides, map: Object.fromEntries(drawn.map((r) => [r.v[decides]!, r.text])) };
      else refused.push('per-variant-text-unqualified: root: no-single-axis');
    }
  }
  return refused;
}

/** Each font stack with the face the pinned browser paints it with put first. A Figma text has one family and no
 * fallback, and the Figma engine takes a stack's first entry; a stack that opens with a system keyword
 * (`-apple-system`) gave none, so Figma drew its fallback (Inter). The face comes from the same signal the reader
 * records per run (CSS.getPlatformFontsForNode, the face with the most glyphs); the rest of the stack stays. */
export function paintedFirst(node: unknown, faces: ReadonlyMap<string, string>): void {
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === 'font-family' && typeof v === 'string' && faces.has(v)) (node as Record<string, unknown>)[k] = `${JSON.stringify(faces.get(v))}, ${v}`;
    else paintedFirst(v, faces);
  }
}
const stacksIn = (node: unknown, out = new Set<string>()): Set<string> => {
  if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) k === 'font-family' && typeof v === 'string' ? out.add(v) : stacksIn(v, out);
  return out;
};

async function main() {
  const flag = (n: string) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
  const out = flag('--out'), storiesPath = flag('--stories'), fileKey = flag('--file-key'), titles = flag('--titles')?.split('|');
  if (!out || !storiesPath) throw Error('usage: storybook-contracts.ts --stories <stories.json> --out <dir> [--storybook <url>] [--titles "a|b"] [--file-key <key>]');
  const read = JSON.parse(readFileSync(storiesPath, 'utf8')) as ReaderOutput, all = declare(read, flag('--storybook')), conventions = profileConventions(read);
  const classPrefix = conventions.has('lost-text-realigns-by-class') ? profileClassPrefix(read) : '';
  mkdirSync(path.join(out, 'contracts'), { recursive: true });
  writeFileSync(path.join(out, 'ds-contracts.react.json'), JSON.stringify(all, null, 2) + '\n');
  const chosen = all.components.filter((c) => !titles || titles.includes(c.subject));
  const base = all.storybook.endsWith('/') ? all.storybook : all.storybook + '/', shown = new URL(base);
  const preload = chosen.length ? readerPreload(read, await (await fetch(new URL('index.json', base))).text()) : [];
  if (['localhost', '127.0.0.1'].includes(shown.hostname)) shown.hostname = 'host.docker.internal';
  const report: Record<string, unknown>[] = [];
  const { browser, stop } = await pinnedBrowser();
  try {
    const { clock, randomSeed, ...context } = PAGE;
    const page = await (await browser.newContext(context)).newPage();
    await page.clock.setFixedTime(new Date(clock));
    await page.addInitScript(`{ let s = ${randomSeed} >>> 0; Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }`);
    const ready = () => page.waitForFunction(() => (window as any).__STORYBOOK_PREVIEW__?.storyStoreValue, null, { timeout: 60_000 });
    const listAll = `(() => { const l = [...getComputedStyle(document.documentElement)].sort(); window.__ALL_PROPS = l; return l; })()`;
    const loadAll = async () => { if (preload.length) await page.evaluate(`(async (ids) => { const store = window.__STORYBOOK_PREVIEW__.storyStoreValue;
      for (const id of ids) await store.loadStory({ storyId: id }); })(${JSON.stringify(preload)})`); };
    const declarations = conventions.has('show-declared-component') ? profileDeclarations(read) : [];
    // A dev-mode Storybook can reload its preview once after load: a render is retried once when that happens.
    const show = async (id: string, args: unknown) => { try { await page.evaluate(`${SHOW}(${declaredShow(declarations, id, args)})`); }
      catch (e) { if (!/Execution context was destroyed|storyStoreValue/.test(String(e))) throw e;
        await page.waitForLoadState('load'); await ready(); await loadAll(); await page.addStyleTag({ content: NO_MOTION }); await page.evaluate(listAll);
        await page.evaluate(`${SHOW}(${declaredShow(declarations, id, args)})`); } };
    if (chosen.length) {
      // The page opens on the reader's first story, as the reader's did, so the stylesheets load in the reader's order.
      await page.goto(new URL(`iframe.html?id=${encodeURIComponent(preload[0] ?? chosen[0]!.cases[0]!.story.id)}&viewMode=story`, shown).href, { waitUntil: 'load', timeout: 60_000 });
      await ready(); await page.waitForLoadState('networkidle');
    }
    const allProps = chosen.length ? await page.evaluate(listAll) as string[] : [];
    await loadAll();
    await page.addStyleTag({ content: NO_MOTION });
    const cdp = await page.context().newCDPSession(page), faces = new Map<string, string>();
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const paintedFace = async (stack: string): Promise<string | undefined> => {
      await page.evaluate(`(async () => { const e = document.createElement('span'); e.id = 'ds-face-probe'; e.style.fontFamily = ${JSON.stringify(stack)};
        e.textContent = 'Hamburgefonstiv 0123'; document.body.appendChild(e); await document.fonts.ready; })()`);
      const { root } = await cdp.send('DOM.getDocument', { depth: 0 }), { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#ds-face-probe' });
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      await page.evaluate(`document.getElementById('ds-face-probe')?.remove()`);
      return [...fonts].sort((a, b) => b.glyphCount - a.glyphCount)[0]?.familyName;
    };
    for (const c of chosen) {
      const row: Record<string, unknown> = { subject: c.subject, refusals: [] as string[] }, refusals = row.refusals as string[];
      report.push(row);
      try {
        const { contract: seeded, drawn, combos, space } = seed(c);
        const comp = { name: c.name, importName: c.name, contract: '(storybook)', sampleText: '', axes: c.axes } as ComponentConfig;
        const captures: Capture[] = [], rootMoved: string[] = [], baselines = new Map<CapturedNode, { px: number; ascent: number; descent: number } | null>();
        const lineBoxes = new Map<CapturedNode, { top: number; bottom: number } | null>();
        for (const [i, k] of c.cases.entries()) {
          await show(k.story.id, k.story.args);
          // Read once every image has loaded or failed, as the reader's references were drawn; one still loading is named.
          if (!await page.evaluate(IMAGES_SETTLED)) { refusals.push(`image-not-settled:${k.id}`); continue; }
          // Grammar decision 5: a reference the reader took from one of the instances a story draws is that instance. It is
          // selected as the reader selected it and read itself, not the cell's first rendered child (another instance, a legend).
          const own = k.story.instance;
          if (own !== undefined && !await page.evaluate(`${SELECT_INSTANCE}(${own})`)) { refusals.push(`instance-not-drawn:${k.id}`); continue; }
          if (!await page.evaluate(MARK_SUBJECT)) { refusals.push(`not-one-element:${k.id}`); continue; }
          const at = captureRootPath(own, conventions);
          if (own === undefined && at && await page.evaluate(SUBJECT_IS_NOT_STAGE_ROOT)) rootMoved.push(k.id);
          const raw = await page.evaluate(captureJs('[data-ds-reader-cell]', IDENTITY_CLASSES, undefined, at,
            true, true)); // the stage's first rendered child (else the selected instance), with set sizes and field text
          if (!raw) { refusals.push(`capture-empty:${k.id}`); continue; }
          const root = normalizeNode(raw as any);
          if (conventions.has('text-baseline-as-drawn')) { // read before any element moves, matched by capture order
            const read = drawnBaselines(root, await page.evaluate(MEASURE_BASELINES(at, conventions.has('text-baseline-as-painted'), conventions.has('root-text-baseline-as-drawn'))) as never);
            if (read) for (const [n, m] of read) baselines.set(n, m); else refusals.push(`text-baseline-unmatched:${k.id}`);
          }
          if (conventions.has('inline-block-line-box-as-drawn')) { // read before any element moves, matched by capture order
            const read = drawnBaselines<{ top: number; bottom: number }>(root, await page.evaluate(MEASURE_LINE_BOXES(at)) as never);
            if (read) for (const [n, m] of read) lineBoxes.set(n, m); else refusals.push(`line-box-unmatched:${k.id}`);
          }
          let generated: (() => void) | null | undefined;
          if (conventions.has('generated-text-carried')) { // read and matched before any element moves
            const tags = await page.evaluate(NUMBER_ELEMENTS(at)) as string[]; // the capture's own root
            generated = carryGeneratedText(root, tags, await generatedText(cdp), (host, span) => { // drawn on its host's line
              const m = baselines.get(host); if (m) baselines.set(span, m); });
            await page.evaluate(NUMBER_ELEMENTS(at, true));
            if (!generated) refusals.push(`generated-text-unmatched:${k.id}`);
          }
          if (conventions.has('svg-rotation-carried')) spellSvgRotation(root);
          if (conventions.has('normal-line-height-as-drawn')) spellNormalLineHeight(root);
          if (conventions.has('svg-own-fill-on-host')) liftSvgOwnFill(root);
          if (conventions.has('svg-viewbox-carried') && !carrySvgViewports(root, await page.evaluate(SVG_VIEWPORTS(at)) as never,
            conventions.has('svg-viewbox-meets-oblong-box')))
            refusals.push(`svg-viewbox-unmatched:${k.id}`);
          if (conventions.has('absolute-in-containing-block')) liftToContainingBlock(root);
          generated?.();
          captures.push({ combo: `${c.name}:${combos[i]!.key}`, interaction: 'default', root });
        }
        row.captured = `${captures.length} of ${c.cases.length}`;
        if (rootMoved.length) row.rootMovedToSubject = rootMoved;
        if (captures.length !== c.cases.length) continue;
        // The in-page control elements and the browser's own baseline, as the computed sweep records them.
        await page.evaluate(`(() => { for (const t of ${JSON.stringify(CONTROL_TAGS)}) { const stage = document.createElement('div'), e = document.createElement(t);
          stage.setAttribute('data-combo', '__control-' + t); e.textContent = 'x'; stage.appendChild(e); document.body.appendChild(stage); } })()`);
        const controls = Object.fromEntries(await Promise.all(CONTROL_TAGS.map(async (t) => [t, normalizeNode(await page.evaluate(captureJs(`[data-combo="__control-${t}"]`)) as any)])));
        await page.evaluate(`document.querySelectorAll('[data-combo^="__control-"]').forEach((e) => e.remove())`);
        const stage = { width: PAGE.viewport.width, height: PAGE.viewport.height, padding: 0 };
        // Convention stage-from-story-container: the root-width doors measure the root against the story page's own
        // container, the viewport inset by where the story's cell starts (the preview body's padding), when it spans evenly.
        const inset = conventions.has('stage-from-story-container') ? await page.evaluate(`(() => { const r = document.querySelector('[data-ds-reader-cell]')?.getBoundingClientRect();
          return r && Math.abs(r.width - (${PAGE.viewport.width} - 2 * r.left)) < 0.5 ? r.left : 0; })()`) as number : 0;
        const uaControls = await captureUaControls(page.context(), { stage, colorScheme: 'light', channels: allProps, classAllow: IDENTITY_CLASSES });
        const sweep = { captures, controls, uaControls, uaBaselineBrowser: browser.version(), allProps, stylesheetSkips: [], browserVersion: browser.version(),
          fontChecks: {}, quarantined: [], pinnedAnimations: [], shadowHostTrails: {}, textFillFolds: {}, closedShadowSuspects: {} } as unknown as SweepResult;
        let aligned = alignSweep(sweep, comp, space, '');
        // Convention lost-text-realigns-by-class: elements align by tag and position; where that loses a variant's own
        // text, the set aligns again by the class stems the profile's prefix names, which keep the two elements apart.
        if (classPrefix && textLostByPosition(aligned, space.baseComboKey, combos.map((k) => k.key))) {
          aligned = alignSweep(sweep, comp, space, classPrefix); row.alignedBy = 'class-stems';
        }
        const promotion = promoteAnatomy(space, comp, aligned.union, kebab(c.name));
        row.parts = [...promotion.partIndex.keys()];
        refusals.push(...promotion.refusals.map((x: unknown) => typeof x === 'string' ? x : JSON.stringify(x)));
        const receipts: string[] = [], styles = (m: Record<string, { style: Record<string, string> }>) => Object.fromEntries(Object.entries(m).map(([t, n]) => [t, n.style]));
        const styled = styledChannels(aligned, space, styles(controls), allProps, receipts, { viewport: PAGE.viewport, stage, portaled: false, ...(inset ? { container: PAGE.viewport.width - 2 * inset } : {}),
          ...(conventions.has('centered-text-keeps-drawn-width') ? { centeredTextWidth: true as const } : {}),
          ...(conventions.has('table-short-row-leaves-columns-empty') ? { tableShortRows: true as const } : {}),
          ...(conventions.has('overlay-size-not-control-default') ? { overlaySizeKept: true as const } : {}) }, styles(uaControls));
        const folds = detectFolds(aligned, styled, receipts, conventions.has('drawn-border-color-not-folded'));
        await boundCheck(aligned, comp, space, async () => '', promotion.contract);
        const layout = enrichLayout(aligned, space, styled, promotion.contract);
        const svgConsumed = new Set([...promotion.consumed].map((i: number) => aligned.partNames[i]));
        const prep = prepareMint(aligned, comp, space, styled, folds, layout.handled, promotion.contract, svgConsumed, new Set(promotion.partIndex.keys()), promotion.gridMintRefusals,
          conventions.has('table-short-row-leaves-columns-empty'));
        const minted = mintedObservations(prep.baseObs, prep.stateObs, conventions.has('unregistered-channel-not-minted')), { baseObs, stateObs } = minted;
        refusals.push(...minted.named);
        const mintBase = mintTokens(c.name, baseObs, prep.axes, { nestedPairs: true }), mintStates = mintTokens(c.name, stateObs, prep.axes, { nestedPairs: true });
        const { enriched, enrichmentNotes } = applyMintToContract(promotion.contract, space, mintBase, baseObs, mintStates, stateObs, layout.enriched,
          prep.declared, prep.declaredStates, prep.setPlaneLiterals, { only: prep.inheritanceOnly, stateDeltas: prep.inheritanceStateDeltas }, prep.stateCodeOnly);
        row.notes = [...receipts, ...enrichmentNotes].length;
        carryRootHugEvidence(enriched as Contract, hugEvidence(aligned, space).hugs);
        // A component with no options has no variant to list: it is written as one main component (GOAL.md, 2026-11-08).
        if (c.axes.length) (enriched as Contract).bindings.figma.drawnVariants = drawn;
        const textOf = (n: { nodes: Array<{ t: string; v?: string }> }) => n.nodes.filter((x) => x.t === 'text').map((x) => x.v ?? '').join('').trim();
        const nodeAt = (key: string, part: string) => { const i = promotion.partIndex.get(part); return i === undefined ? null : aligned.getAligned(`${key}__default`)[i]?.node as
          { tag: string; field?: { value: string } } | undefined ?? null; };
        const selected = (key: string, part: string) => { const n = nodeAt(key, part); return n?.tag === 'select' && n.field ? n.field.value : null; };
        if (conventions.has('closed-select-draws-selected-label')) // its label where it is first drawn; a part some variants lack is still read
          closedSelectLabels(enriched as Contract, (part) => combos.map((k) => selected(k.key, part)).find((v) => v !== null) ?? null);
        refusals.push(...carryVariantText(enriched as Contract, c.axes, combos, (key, part) => {
          const i = promotion.partIndex.get(part), el = i === undefined ? null : aligned.getAligned(`${key}__default`)[i];
          return !el ? null : conventions.has('closed-select-draws-selected-label') && selected(key, part) !== null ? selected(key, part) : textOf(el.node as never); }, (key, part) => {
          const i = promotion.partIndex.get(part), el = i === undefined ? null : aligned.getAligned(`${key}__default`)[i];
          return (el?.node as { field?: { value: string; placeholder: string } } | undefined)?.field ?? null; }, conventions.has('root-text-by-axis'),
          conventions.has('variant-text-owns-its-part'), conventions.has('field-value-without-axes')));
        if (conventions.has('single-row-grid-as-row')) {
          const [lowered, named] = lowerSingleRowGrid(enriched as Contract, combos, (key, part) => nodeAt(key, part) as CapturedNode | null);
          row.gridAsRow = lowered; refusals.push(...named);
        }
        if (conventions.has('align-self-center-in-stretched-box')) {
          const [carried, named] = carryAlignSelfCenter(enriched as Contract, combos, (key, part) => nodeAt(key, part) as CapturedNode | null);
          row.alignSelfCenter = carried; refusals.push(...named);
        }
        if (conventions.has('text-baseline-as-drawn')) row.textBaseline = carryTextBaseline(enriched as Contract, c.axes, combos, (key, part) => {
          const n = nodeAt(key, part); return n ? baselines.get(n as never) ?? null : undefined; }, conventions.has('root-text-baseline-as-drawn'));
        if (conventions.has('inline-block-line-box-as-drawn')) row.lineBox = carryLineBox(enriched as Contract, c.axes, combos, (key, part) => {
          const n = nodeAt(key, part); return n ? lineBoxes.get(n as never) ?? null : undefined; });
        for (const stack of stacksIn((enriched as Contract).anatomy)) if (!faces.has(stack) && !stack.startsWith('{')) { const face = await paintedFace(stack); if (face) faces.set(stack, face); }
        paintedFirst((enriched as Contract).anatomy, faces);
        const contract = ContractSchema.parse(enriched) as Contract, file = kebab(c.name);
        writeFileSync(path.join(out, 'contracts', `${file}.contract.json`), JSON.stringify(contract, null, 2) + '\n');
        const engine = createFigmaEngine({ tokens: { primitives: structuredClone(mintBase.tree), semantic: {}, light: {}, dark: {}, brands: { default: {} } } as any, icons: promotion.assets, conventions });
        const data = engine.compileComponentData(contract, new Map([[contract.id, contract]])) as { setName: string; isSet: boolean; variants?: unknown[] };
        if (fileKey) { // each script refuses any other file; both are built before either is written
          const tokensScript = engine.buildTokensScript(fileKey), componentScript = engine.buildComponentScript(contract, new Map([[contract.id, contract]]), fileKey);
          mkdirSync(path.join(out, 'figma'), { recursive: true });
          writeFileSync(path.join(out, 'figma', `${file}.1-variables.js`), tokensScript);
          writeFileSync(path.join(out, 'figma', `${file}.2-component.js`), componentScript);
        }
        // Named only once its scripts are built: a contract the Figma build refuses reaches no Figma file.
        Object.assign(row, { contract: contract.id, setName: data.setName, isSet: data.isSet, variants: data.variants?.length ?? null });
      } catch (e) { const m = String(e instanceof Error ? e.message : e); refusals.push('error: ' + (m.startsWith('[') ? m.replace(/\s+/g, ' ').slice(0, 600) : m.split('\n').filter(Boolean).slice(0, 3).join(' / '))); }
      console.log(JSON.stringify(row));
    }
  } finally { await browser.close(); stop(); }
  writeFileSync(path.join(out, 'storybook-contracts.json'), JSON.stringify({ storybook: all.storybook, react: all.react, refused: all.refused, components: report }, null, 2) + '\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
