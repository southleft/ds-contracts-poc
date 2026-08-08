/**
 * COMPUTED-CAPTURE FLOOR — Round 4: DOM-ANATOMY PROMOTION.
 *
 * The decisive fix for the one-to-one round: computed-only DOM elements —
 * captured by the floor but never carried — become REAL contract parts.
 *
 *   · UNION ALIGNMENT — captures are aligned into ONE union tree by
 *     hierarchical signature matching (tag + class stems, nth occurrence
 *     among same-signature siblings within the SAME parent), replacing the
 *     path-equality alignment that could only see the base combo's tree.
 *     Structure-creating optional props (Banner onDismiss → dismiss button)
 *     add union parts that the base combo never renders.
 *   · PART PROMOTION — every union element becomes a Part in the enriched
 *     contract at its captured nesting position. The static layer wins NAMES
 *     and semantics (§4.5): a static part with no captured name-match is
 *     re-joined by element/content evidence before anything is invented.
 *   · SVG CONTENT AS ASSETS — an element subtree rooted at <svg> is carried
 *     as a committed icon asset reconstructed from captured computed truth
 *     (the CSS `d` property carries every path's geometry; fill/fill-rule
 *     ride along). Markup varying over ONE axis lands as per-value icon
 *     parts gated by visibleWhen — existing vocabulary, no new schema.
 *     The viewBox is reconstructed from the svg's computed size and checked
 *     against the path data's coordinate extent — a NAMED reconstruction.
 *   · PRESENCE FACTS — a part present in only some combos carries
 *     visibleWhen (single boolean-true factor) and/or stylesWhen
 *     display:none entries (per-axis complement factors) when its presence
 *     set factors as a product of per-axis sets; anything else refuses BY
 *     NAME (never a silently always-drawn phantom).
 *
 * Pure module (no fs, no browser): run.ts writes the asset files.
 */
import type { Contract, Part } from '../../scripts/contract-schema.js';
import { walkAnatomy } from '../../scripts/contract-schema.js';
import { PRESENCE_ON, PRESENCE_OFF, type ComponentConfig, type PropSpace } from './capture.js';
import { DECOR_PSEUDOS, isAbsurdRadius, PILL_RADIUS_SENTINEL, signature, stems, type Capture, type CapturedNode, type Combo, type FlatEl } from './lib.js';

// ---------------------------------------------------------------------------
// ORGANISM ROUND (Table) — TABLE-DISPLAY LOWERING
// ---------------------------------------------------------------------------
/** The CSS table box model is outside EVERY vocabulary the schema speaks:
 *  `LayoutSchema.display` is flex|inline-flex and the declared registry is
 *  inline|inline-block|block|contents|none. Before this round a
 *  `display:table-row` part fell through to the
 *  `display-outside-vocabulary` receipt and then took the emitter's default
 *  layoutSpec (HORIZONTAL/CENTER/CENTER) — structurally wrong for a table
 *  and SILENT.
 *
 *  The decision (organism round): do NOT grow the declared registry with
 *  table keywords no target can render. LOWER the table box model to the
 *  flex vocabulary it is behaviorally equivalent to for the non-spanning,
 *  colgroup-free case the anatomy can see:
 *
 *    table / inline-table / table-header-group / table-row-group /
 *    table-footer-group        → column stack, children stretch (rows fill
 *                                the table width — exactly what a table does)
 *    table-row                 → row, children stretch (every cell takes the
 *                                row's height — the table box model's own
 *                                rule; the CELLS then center their content)
 *    table-cell                → row; counter axis from the cell's OWN
 *                                computed vertical-align, main axis from its
 *                                computed text-align (align="right" columns)
 *    table-column / -caption   → NOT lowered (named residue below)
 *
 *  Everything the lowering cannot express — border-collapse, border-spacing,
 *  table-layout, colspan/rowspan — keeps flowing through the ordinary
 *  declared/codeOnly path and is named there.
 *
 *  Every lowering emits a `table-lowering:` receipt. */
const TABLE_DISPLAYS = new Set([
  'table', 'inline-table', 'table-header-group', 'table-row-group', 'table-footer-group',
  'table-row', 'table-cell',
]);

export const isTableDisplay = (d: string | undefined): boolean => (d ?? '').startsWith('table') || d === 'inline-table';

export interface TableLowering {
  layout: NonNullable<Part['layout']>;
  note: string;
}

/** Pure: lower ONE computed table display to the flex vocabulary, reading
 *  the element's own vertical-align / text-align for the axis alignments.
 *  Returns null for table displays outside the lowered set (named residue). */
export function lowerTableDisplay(display: string, style: Record<string, string>): TableLowering | null {
  const vAlign = style['vertical-align'] ?? '';
  const counter =
    vAlign === 'middle' ? 'center' : vAlign === 'bottom' ? 'end' : vAlign === 'top' ? 'start' : null;
  switch (display) {
    case 'table':
    case 'inline-table':
    case 'table-header-group':
    case 'table-row-group':
    case 'table-footer-group':
      return {
        layout: { display: 'flex', direction: 'column', align: 'stretch' },
        note: `${display} → flex column, children stretch (row groups stack and fill the table width)`,
      };
    case 'table-row':
      return {
        layout: { display: 'flex', direction: 'row', align: 'stretch' },
        note: 'table-row → flex row, children stretch (every cell takes the row height — the table box model\'s own rule; the cell centers its own content)',
      };
    case 'table-cell': {
      const ta = style['text-align'] ?? '';
      const justify = ta === 'right' || ta === 'end' ? 'end' : ta === 'center' ? 'center' : 'start';
      return {
        layout: { display: 'flex', direction: 'row', align: counter ?? 'center', justify },
        note: `table-cell → flex row (counter axis ${counter ?? 'center (vertical-align "' + (vAlign || 'unset') + '" outside the lowered set — middle assumed, named)'}, main axis ${justify} from text-align:${ta || 'unset'})`,
      };
    }
    default:
      return null;
  }
}

/** CARBON LIVE-DEFECT ROUND (D3) — CSS GRID LOWERED TO THE FLEX VOCABULARY.
 *
 *  `display:grid` / `inline-grid` had NO lowering at all: the part fell to the
 *  `display-outside-vocabulary` receipt, carried no `layout` and no `declared
 *  .display`, and the emitter's HORIZONTAL default then drew Carbon's Modal
 *  header/body/footer SIDE BY SIDE inside a container narrower than any of
 *  them (`modal-container` grid, 1 column × 4 rows) — the live paste's
 *  overlapping copy. Two of Carbon's ten components are built this way.
 *
 *  The lowering is MEASURED, never guessed: `grid-template-columns` and
 *  `grid-template-rows` resolve to explicit px track lists in computed style,
 *  so the track COUNTS are captured facts.
 *    · 1 column, ≥1 row   → flex COLUMN (a stack)      — gap from `row-gap`
 *    · 1 row, >1 column   → flex ROW                   — gap from `column-gap`
 *    · >1 column AND >1 row → REFUSED BY NAME: a 2D grid has no auto-layout
 *      spelling; one axis would have to be invented.
 *    · no explicit tracks (implicit-only) → REFUSED BY NAME.
 *  Item alignment follows CSS: the lowered flex CROSS axis takes
 *  `justify-items` for a column stack (cross = inline) and `align-items` for
 *  a row (cross = block). Grid's own default for both is `normal`, which for
 *  grid items MEANS stretch — carried as such, not dropped. */
export interface GridLowering {
  layout: NonNullable<Part['layout']>;
  note: string;
}

const gridTracks = (v: string | undefined): number => {
  const s = (v ?? 'none').trim();
  if (s === 'none' || s === '' || s === 'auto') return 0;
  return s.split(/\s+(?![^[]*\])/).filter((t) => t !== '' && !t.startsWith('[')).length;
};

const gridAlign = (v: string | undefined): 'start' | 'center' | 'end' | 'stretch' => {
  const s = (v ?? 'normal').trim().split(/\s+/).pop() ?? 'normal';
  if (s === 'center') return 'center';
  if (s === 'start' || s === 'flex-start' || s === 'self-start' || s === 'left') return 'start';
  if (s === 'end' || s === 'flex-end' || s === 'self-end' || s === 'right') return 'end';
  return 'stretch'; // 'normal' / 'stretch' — a grid item's default IS stretch
};

export function lowerGridDisplay(
  display: string,
  style: Record<string, string>,
): GridLowering | { refusal: string } | null {
  if (display !== 'grid' && display !== 'inline-grid') return null;
  const cols = gridTracks(style['grid-template-columns']);
  const rows = gridTracks(style['grid-template-rows']);
  const d = display === 'inline-grid' ? 'inline-flex' : 'flex';
  if (cols === 0 && rows === 0) {
    return { refusal: `grid-implicit-tracks: ${display} declares no explicit grid-template-columns/rows (implicit tracks only) — the track counts that decide the lowered axis are not measurable; no layout carried (named refusal)` };
  }
  if (cols > 1 && rows > 1) {
    return { refusal: `grid-two-dimensional: ${display} resolves ${cols} columns × ${rows} rows — a two-dimensional grid has no auto-layout spelling (one axis would have to be invented); no layout carried (named refusal)` };
  }
  if (cols <= 1) {
    return {
      layout: { display: d, direction: 'column', align: gridAlign(style['justify-items']) },
      note: `${display} ${cols || 1}×${rows} → flex column, cross-axis ${gridAlign(style['justify-items'])} from justify-items:${style['justify-items'] ?? 'normal'} (measured track counts)`,
    };
  }
  return {
    layout: { display: d, direction: 'row', align: gridAlign(style['align-items']) },
    note: `${display} ${cols}×${rows || 1} → flex row, cross-axis ${gridAlign(style['align-items'])} from align-items:${style['align-items'] ?? 'normal'} (measured track counts)`,
  };
}

/** The ARIA role a lowered table box keeps (the table box model's meaning,
 *  carried on a plain <div> — see the element lowering in buildPart). */
export function tableRoleFor(display: string, tag: string): string | null {
  switch (display) {
    case 'table':
    case 'inline-table':
      return 'table';
    case 'table-header-group':
    case 'table-row-group':
    case 'table-footer-group':
      return 'rowgroup';
    case 'table-row':
      return 'row';
    case 'table-cell':
      return tag === 'th' ? 'columnheader' : 'cell';
    default:
      return null;
  }
}

/** Visually-hidden (sr-only) style signature: clip-path inset(50%) or the
 *  1px clip box. Part of the UNION signature — a toned Badge renders an
 *  sr-only announcement span with the same tag+stems as the visible label,
 *  and occurrence matching would otherwise swap their identities. */
export const isSrOnlyStyle = (st: Record<string, string>): boolean =>
  (st['clip-path'] ?? '').startsWith('inset(50%') ||
  (st['overflow'] === 'hidden' && st['width'] === '1px' && st['height'] === '1px') ||
  // MUI round (Slider/Switch live finding): two more hiding idioms — the
  // legacy clip rect (Slider's input) and opacity:0 (Switch's input, drawn
  // 300% wide over the whole control). Without these the promoted input
  // parts carried their default WHITE background and painted over the thumb.
  st['clip'] === 'rect(0px, 0px, 0px, 0px)' ||
  st['opacity'] === '0';

// ===========================================================================
// DEPTH BUILD — Stage B: root descent through transparent wrappers (N3 fix).
//
// Ported VERBATIM from extract/depth-spike/run.ts (the proven prototype). A
// portaled new root (Modal's ThemeProvider container) is normalized THROUGH
// transparent wrappers — display:contents (Fragment idiom), box-less theme /
// anonymous containers, single-child box-less passthroughs — to the real
// styled root(s), supporting MULTI-ROOT (a container with several kept
// children is several real roots: Modal = {dialog, backdrop}).
//
// CRITICAL (regression safety): descent is applied ONLY at the seed — to the
// portaled new root, ONCE — to find the real root(s). It is NEVER run over a
// census capture: `buildUnion`/`alignSweep`/`sweep` are unchanged, so the 12
// committed components stay byte-identical. For an HTML-rooted component whose
// root carries a box (Badge span, Button button, Checkbox label), realRootsOf
// returns [root] unchanged (the additive/passthrough-only guarantee) — the
// regression guard (simple-component-anatomy-unchanged) pins exactly that.
// ---------------------------------------------------------------------------
/** Direct text runs of a node, concatenated and trimmed. */
const directText = (n: CapturedNode): string =>
  n.nodes.filter((c) => c.t === 'text').map((c) => (c as { v: string }).v).join('').trim();
/** Element children of a node (drops interleaved text runs). */
const childEls = (n: CapturedNode): CapturedNode[] =>
  n.nodes.filter((c) => c.t === 'el').map((c) => (c as { el: CapturedNode }).el);

/** A node draws NO box of its own: transparent background, no border, no
 *  shadow. (Geometry/padding are ignored — a box-less positioning div still
 *  reserves space but carries no anatomy.) */
export function isBoxlessNode(n: CapturedNode): boolean {
  const s = n.style;
  const bg = s['background-color'];
  const bgTransparent = !bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent';
  const noBorder = (s['border-top-width'] === '0px' || !s['border-top-width']) && (s['border-bottom-width'] === '0px' || !s['border-bottom-width']);
  const noShadow = !s['box-shadow'] || s['box-shadow'] === 'none';
  return bgTransparent && noBorder && noShadow;
}
const isThemeContainerNode = (n: CapturedNode): boolean => n.classes.some((c) => /theme/i.test(c));

/** Normalize a node THROUGH transparent wrappers to its real root(s), WITHOUT
 *  recursing into KEPT nodes' descendants (their raw children are preserved so
 *  the census union sees the full styled tree below the real root). Unwraps, in
 *  order: display:contents (Fragment / passthrough) → its children (multi-root);
 *  box-less theme/anon container with children → its children (multi-root: the
 *  Modal portal renders {dialog, backdrop} under one ThemeProvider div);
 *  single-child box-less passthrough → its child. A node with its own box,
 *  ARIA role, direct text, or a real class-stem is KEPT with raw children
 *  intact (the dialog, the backdrop, the list, the activator, the overlay).
 *
 *  `classPrefix` is the LIBRARY'S OWN, threaded from the capture config. It
 *  used to be a module constant spelled `'Polaris-'` — a vendor name sitting
 *  on the live path for every library. The descent only asks whether a wrapper
 *  has ANY own class-stem, so the wrong prefix was survivable (it can only
 *  over-keep, never over-strip) but it made the answer library-dependent for
 *  no reason. Defaulted to `''` so a caller with no config (the spike
 *  receipts) keeps the "any class at all is a stem" reading. */
export function realRootsOf(n: CapturedNode, classPrefix = ''): CapturedNode[] {
  if (n.style['display'] === 'contents') return childEls(n).flatMap((c) => realRootsOf(c, classPrefix));
  if (directText(n).length > 0 || (n.role != null && n.role !== '')) return [n];
  const boxless = isBoxlessNode(n);
  const kids = childEls(n);
  if (boxless && kids.length >= 1 && (stems(n.classes, classPrefix).length === 0 || isThemeContainerNode(n))) {
    return kids.flatMap((c) => realRootsOf(c, classPrefix)); // anon/theme wrapper → unwrap (multi-root)
  }
  if (boxless && kids.length === 1) return realRootsOf(kids[0], classPrefix); // single-child passthrough
  return [n];
}

/** Descend a captured new-root to its real root(s) (the Stage-B seed). */
export const descendToRealRoots = (n: CapturedNode, classPrefix = ''): CapturedNode[] =>
  realRootsOf(n, classPrefix);

/** A real root's part-name for a MULTI-root anatomy: role=dialog → 'dialog';
 *  aria-modal → 'dialog'; else the class-stem's last BEM segment lowercased
 *  (Polaris-Modal-Dialog → 'dialog', Polaris-Backdrop → 'backdrop'); fallback
 *  root-<index>. A SINGLE real root always keys as 'root' (byte-identical to
 *  the single-root promotion — the regression guard depends on this). */
export function rootPartName(n: CapturedNode, classPrefix: string, index: number, total: number): string {
  if (total <= 1) return 'root';
  if (n.role === 'dialog' || n.ariaModal === 'true') return 'dialog';
  const stem = stems(n.classes, classPrefix)[0];
  if (stem) {
    const seg = stem.split('-').filter(Boolean).pop() ?? stem;
    const name = seg.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    if (name) return name;
  }
  return `root-${index + 1}`;
}

// ---------------------------------------------------------------------------
// Union alignment
// ---------------------------------------------------------------------------
export interface UnionNode {
  id: number;
  sig: string;
  /** Representative captured element (base capture when present there). */
  rep: CapturedNode;
  /** Representative path (in the capture that introduced the node). */
  repPath: string;
  /** Capture key that introduced the node ('' = the base capture). */
  repKey: string;
  inBase: boolean;
  parent: UnionNode | null;
  children: UnionNode[];
  partName: string;
}

export interface UnionResult {
  /** DFS order over the final union tree. */
  entries: UnionNode[];
  /** capture key → aligned FlatEl per union entry (null = absent). */
  alignedByKey: Map<string, (FlatEl | null)[]>;
  receipts: string[];
}

export function buildUnion(
  captures: Capture[],
  base: Capture,
  classPrefix: string,
): UnionResult {
  const receipts: string[] = [];
  let nextId = 0;
  const sigOf = (node: CapturedNode): string =>
    `${signature(node, classPrefix)}${isSrOnlyStyle(node.style) ? '|sr-only' : ''}`;
  const mk = (node: CapturedNode, path: string, parent: UnionNode | null, inBase: boolean, repKey: string): UnionNode => ({
    id: nextId++,
    sig: sigOf(node),
    rep: node,
    repPath: path,
    repKey,
    inBase,
    parent,
    children: [],
    partName: '',
  });

  // Seed from the base capture.
  const root = mk(base.root, '', null, true, '');
  const seed = (u: UnionNode, node: CapturedNode, path: string) => {
    let i = 0;
    for (const c of node.nodes) {
      if (c.t !== 'el') continue;
      const childPath = path === '' ? String(i) : `${path}.${i}`;
      const uc = mk(c.el, childPath, u, true, '');
      u.children.push(uc);
      seed(uc, c.el, childPath);
      i++;
    }
  };
  seed(root, base.root, '');

  // Align every capture (base included, for a uniform aligned map).
  const rawAligned = new Map<string, Map<number, FlatEl>>();
  for (const cap of captures) {
    const key = `${cap.combo}__${cap.interaction}`;
    const out = new Map<number, FlatEl>();
    const align = (u: UnionNode, node: CapturedNode, path: string) => {
      const sig = sigOf(node);
      if (sig !== u.sig && u.parent === null) {
        receipts.push(`root-signature-varies: ${key}: ${u.sig} → ${sig} (element-varies receipt; root always aligns)`);
      }
      out.set(u.id, { path, sig, partName: '', node });
      // TWO-PASS document-order merge: first match capture children to union
      // children by (signature, nth occurrence); then walk in capture order,
      // inserting NEW union nodes at the cursor — BEFORE the next matched
      // sibling — so union order follows document order (the Badge pip sits
      // LEFT of the label) while existing union nodes never reorder.
      const bySig = new Map<string, UnionNode[]>();
      for (const uc of u.children) (bySig.get(uc.sig) ?? bySig.set(uc.sig, []).get(uc.sig)!).push(uc);
      const used = new Map<string, number>();
      const pairs: Array<{ el: CapturedNode; path: string; match: UnionNode | null; sig: string }> = [];
      let i = 0;
      for (const c of node.nodes) {
        if (c.t !== 'el') continue;
        const childPath = path === '' ? String(i) : `${path}.${i}`;
        i++;
        const csig = sigOf(c.el);
        const n = used.get(csig) ?? 0;
        used.set(csig, n + 1);
        const list = bySig.get(csig);
        pairs.push({ el: c.el, path: childPath, match: list && n < list.length ? list[n] : null, sig: csig });
      }
      let cursor = 0;
      for (const pr of pairs) {
        if (pr.match) {
          const at = u.children.indexOf(pr.match);
          if (at >= cursor) cursor = at + 1;
          else receipts.push(`union-order-drift: ${key} @${pr.path} (${pr.sig}) matched behind the cursor — document order varies across captures (named)`);
          align(pr.match, pr.el, pr.path);
        } else {
          const uc = mk(pr.el, pr.path, u, false, key);
          u.children.splice(cursor, 0, uc);
          cursor++;
          receipts.push(`union-part-added: ${key} @${pr.path} (${pr.sig})`);
          align(uc, pr.el, pr.path);
        }
      }
    };
    align(root, cap.root, '');
    rawAligned.set(key, out);
  }

  // Final DFS order + aligned arrays.
  const entries: UnionNode[] = [];
  const dfs = (u: UnionNode) => {
    entries.push(u);
    for (const c of u.children) dfs(c);
  };
  dfs(root);
  const alignedByKey = new Map<string, (FlatEl | null)[]>();
  for (const [key, m] of rawAligned) {
    alignedByKey.set(key, entries.map((e) => m.get(e.id) ?? null));
  }
  return { entries, alignedByKey, receipts: [...new Set(receipts)] };
}

// ---------------------------------------------------------------------------
// Part naming over the union (extends lib.namePart to union entries) +
// static re-join (the static layer wins NAMES — §4.5)
// ---------------------------------------------------------------------------
export function nameUnion(
  entries: UnionNode[],
  componentName: string,
  classPrefix: string,
): void {
  const seen = new Map<string, number>();
  // BASE-capture entries claim names first (DFS order), then off-base
  // entries — an off-base subtree inserted before a base element (linked
  // Tag's inner text) must never steal the base element's name.
  const ordered = [...entries.filter((e) => e.inBase), ...entries.filter((e) => !e.inBase)];
  for (const e of ordered) {
    let name: string;
    if (e.parent === null) name = 'root';
    else if (e.rep.tag === 'svg') name = 'icon';
    else if (e.rep.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0)) name = 'label';
    else {
      const stem = stems(e.rep.classes, classPrefix)[0];
      // fallback names are CSS-class-safe (they become real part class names
      // in the promoted contract — dots would break every selector)
      name = stem
        ? stem.replace(new RegExp(`^${componentName}__?`), '').toLowerCase() || 'root'
        : `part-${e.repPath.replace(/\./g, '-')}`;
    }
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    e.partName = n > 0 ? `${name}-${n + 1}` : name;
  }
}

/** Re-join static-only parts to unmatched union entries by element/content
 *  evidence: the static part's element tag must equal the captured tag, and
 *  when the static part binds text content, the captured text must equal the
 *  bound prop's mounted sample. A unique match RENAMES the union entry to
 *  the static (human-reviewed) name. */
export function rejoinStaticParts(
  entries: UnionNode[],
  contract: Contract,
  comp: ComponentConfig,
  receipts: string[],
): void {
  const walked = walkAnatomy(contract);
  const staticByName = new Map(walked.map((w) => [w.name, w.part] as const));
  const captured = new Set(entries.map((e) => e.partName));
  const textOf = (n: CapturedNode): string =>
    n.nodes.filter((c) => c.t === 'text').map((c) => (c as { v: string }).v).join('').trim();
  const sampleFor = (propName: string): string | undefined => {
    const prop = contract.props.find((p) => p.name === propName);
    if (!prop) return undefined;
    if (prop.bindings.code.prop === 'children') return comp.sampleText;
    const fixed = comp.fixedProps?.[propName];
    return typeof fixed === 'string' ? fixed : typeof prop.default === 'string' ? prop.default : undefined;
  };
  for (const [name, part] of staticByName) {
    if (captured.has(name)) continue;
    const el = part.element ?? (part.content || part.text !== undefined ? 'span' : 'div');
    const wantText = part.content ? sampleFor(part.content.prop) : part.text;
    const candidates = entries.filter((e) => {
      if (e.parent === null || staticByName.has(e.partName)) return false;
      if (e.rep.tag !== el) return false;
      if (wantText !== undefined) return textOf(e.rep) === wantText;
      return false; // element-only evidence is too weak to claim a reviewed name
    });
    const pick = candidates.length === 1 ? candidates[0]
      : candidates.filter((c) => c.inBase).length === 1 ? candidates.filter((c) => c.inBase)[0]
      : null;
    if (pick) {
      receipts.push(`static-rejoin: captured "${pick.partName}" renamed to reviewed static part "${name}" (element ${el}${wantText !== undefined ? ` + content "${wantText}"` : ''}${candidates.length > 1 ? '; base-capture candidate preferred' : ''})`);
      pick.partName = name;
      captured.add(name);
    }
  }
}

// ---------------------------------------------------------------------------
// Presence factorization
// ---------------------------------------------------------------------------
export interface PresenceFact {
  /** visibleWhen on a boolean-true presence factor (≤1). */
  visibleWhen?: { prop: string };
  /** stylesWhen display:none entries for complement factors. */
  hiddenWhen: Array<{ prop: string; equals?: string }>;
  /** Defaultless-axis strategy: the part is HIDDEN AT BASE (declared
   *  display:none) and SHOWN per set value — the only spelling for
   *  "present iff the defaultless prop is set" (the unset pseudo-value is
   *  not a contract enum value, so hiddenWhen cannot name it). */
  shownWhen: Array<{ prop: string; equals: string }>;
  receipts: string[];
}

/** Factor a presence set over the enabled default-interaction combos.
 *  Returns null when presence does not factor as a product of per-axis sets
 *  (the part must then refuse promotion by name). `presenceProps` maps axis
 *  prop → true when the axis is a presence axis (off/on ↔ boolean false/
 *  true on the contract side). */
export function factorPresence(
  presentCombos: Combo[],
  allCombos: Combo[],
  axes: PropSpace['axes'],
  presenceProps: Set<string>,
  stateProps: string[],
  partName: string,
  /** Contract prop names — a factor can only spell conditions on real props
   *  (Button declares the disabled STATE with no disabled prop). */
  contractProps?: Set<string>,
): PresenceFact | null {
  const receipts: string[] = [];
  if (presentCombos.length === allCombos.length) return { hiddenWhen: [], shownWhen: [], receipts };
  if (presentCombos.length === 0) return null;
  const presentKeys = new Set(presentCombos.map((c) => c.key));
  // per-axis observed value sets among present combos (state props are axes
  // too — value 'true'/'false')
  const axisNames = [...axes.map((a) => a.prop), ...stateProps];
  const valueOf = (c: Combo, ax: string): string =>
    ax in c.axisValues ? c.axisValues[ax] : String(c.stateFlags[ax]);
  const valuesFor = (ax: string): string[] => {
    const a = axes.find((x) => x.prop === ax);
    return a ? a.values : ['false', 'true'];
  };
  const sets = new Map<string, Set<string>>();
  for (const ax of axisNames) sets.set(ax, new Set(presentCombos.map((c) => valueOf(c, ax))));
  // product check: every combo whose per-axis values are all in the sets
  // must be present, and vice versa (vice versa holds by construction).
  for (const c of allCombos) {
    const inProduct = axisNames.every((ax) => sets.get(ax)!.has(valueOf(c, ax)));
    if (inProduct !== presentKeys.has(c.key)) {
      return null; // not a product — refuse upstream by name
    }
  }
  const fact: PresenceFact = { hiddenWhen: [], shownWhen: [], receipts };
  for (const ax of axisNames) {
    const va = sets.get(ax)!;
    const all = valuesFor(ax);
    if (va.size === all.length) continue; // axis does not constrain presence
    const spec = axes.find((x) => x.prop === ax);
    if (spec?.unset !== undefined && !presenceProps.has(ax) && !va.has(spec.unset)) {
      // defaultless enum axis, present only when SET: base-hidden strategy —
      // the unset pseudo-value is not a contract enum value, so the
      // complement has no hiddenWhen spelling. Show per set value instead.
      for (const v of all) {
        if (v === spec.unset || !va.has(v)) continue;
        fact.shownWhen.push({ prop: ax, equals: v });
      }
      continue;
    }
    if (presenceProps.has(ax)) {
      if (va.size === 1 && va.has(PRESENCE_ON)) {
        if (fact.visibleWhen) {
          // two boolean-true factors — visibleWhen carries one; the second
          // has no complement spelling (stylesWhen booleans are truthy-only)
          receipts.push(`presence-second-boolean-factor: ${partName} also requires ${ax}=on — carried via visibleWhen on ${fact.visibleWhen.prop} only; residue named`);
          return null;
        }
        fact.visibleWhen = { prop: ax };
      } else if (va.size === 1 && va.has(PRESENCE_OFF)) {
        // present only when the boolean is OFF → hidden when ON (truthy)
        fact.hiddenWhen.push({ prop: ax });
      }
    } else if (stateProps.includes(ax)) {
      if (va.size === 1 && va.has('false')) {
        if (contractProps && !contractProps.has(ax)) {
          // the contract declares the STATE with no prop (Button disabled) —
          // there is no stylesWhen spelling; DROP the factor (the part
          // renders in the state plane too), receipted.
          receipts.push(`state-axis-presence-dropped: ${partName} absent under ${ax} but the contract has no "${ax}" prop — factor dropped, part renders in that plane (named residue)`);
        } else {
          fact.hiddenWhen.push({ prop: ax });
        }
      } else return null; // present only when disabled — no spelling
    } else {
      // enum axis: hide on each complement value (the unset pseudo-value is
      // handled by the base-hidden branch above and never lands here)
      for (const v of all) {
        if (v === spec?.unset) continue;
        if (!va.has(v)) fact.hiddenWhen.push({ prop: ax, equals: v });
      }
    }
  }
  return fact;
}

/** Round 5c — COMPLEMENT-OF-PRODUCT presence (the Tag default-label class).
 *  A default subtree that an ALTERNATIVE subtree replaces (Tag's label moves
 *  inside the link when `linked` is set and `clickable` is not) has a
 *  presence set that is the COMPLEMENT of a product — the product test
 *  refuses it, and round 5a showed that refusal blanks the whole component.
 *  When the ABSENCE set factors as a product of per-axis sets, the part is
 *  spellable as an ORDERED stylesWhen cascade: hide entries on ONE trigger
 *  axis's absence values, then RESTORE entries on every other constraining
 *  axis's complement values — later rules win at equal specificity, so
 *  hidden(c) = trigger-matches(c) ∧ ¬restore-matches(c) = the absence
 *  product, exactly. The chain is VERIFIED against every captured combo
 *  before it is carried; anything unverifiable refuses by name.
 *
 *  Domain note: this runs over ALL default-interaction combos (state planes
 *  included — a disabled Tag renders the plain label even when linked), so
 *  the disabled restore is part of the carried truth. */
export interface ComplementFact {
  hide: Array<{ prop: string; equals?: string }>;
  restore: Array<{ prop: string; equals?: string }>;
  receipts: string[];
}

export function factorComplement(
  presentKeys: Set<string>,
  allCombos: Combo[],
  axes: PropSpace['axes'],
  presenceProps: Set<string>,
  stateProps: string[],
  partName: string,
  contractProps: Set<string>,
): ComplementFact | null {
  const absent = allCombos.filter((c) => !presentKeys.has(c.key));
  if (absent.length === 0 || absent.length === allCombos.length) return null;
  const axisNames = [...axes.map((a) => a.prop), ...stateProps];
  const valueOf = (c: Combo, ax: string): string =>
    ax in c.axisValues ? c.axisValues[ax] : String(c.stateFlags[ax]);
  const valuesFor = (ax: string): string[] => {
    const a = axes.find((x) => x.prop === ax);
    return a ? a.values : ['false', 'true'];
  };
  const sets = new Map(axisNames.map((ax) => [ax, new Set(absent.map((c) => valueOf(c, ax)))] as const));
  const absentKeys = new Set(absent.map((c) => c.key));
  for (const c of allCombos) {
    const inProduct = axisNames.every((ax) => sets.get(ax)!.has(valueOf(c, ax)));
    if (inProduct !== absentKeys.has(c.key)) return null; // absence is not a product either
  }
  const constraining = axisNames.filter((ax) => sets.get(ax)!.size < valuesFor(ax).length);
  if (constraining.length === 0) return null;
  /** stylesWhen conditions selecting exactly `values` of axis `ax`, or null
   *  when the vocabulary has no spelling (truthy-only booleans; the unset
   *  pseudo-value is not a contract enum value; a state axis needs a real
   *  contract prop). */
  const spell = (ax: string, values: string[]): Array<{ prop: string; equals?: string }> | null => {
    if (values.length === 0) return null;
    if (presenceProps.has(ax)) {
      return values.length === 1 && values[0] === PRESENCE_ON ? [{ prop: ax }] : null;
    }
    if (stateProps.includes(ax)) {
      return values.length === 1 && values[0] === 'true' && contractProps.has(ax) ? [{ prop: ax }] : null;
    }
    const spec = axes.find((x) => x.prop === ax);
    if (!spec || !contractProps.has(ax)) return null;
    if (values.some((v) => v === spec.unset)) return null; // unset pseudo-value has no condition spelling
    return values.map((v) => ({ prop: ax, equals: v }));
  };
  const matches = (cond: { prop: string; equals?: string }, c: Combo): boolean => {
    const v = valueOf(c, cond.prop);
    if (cond.equals !== undefined) return v === cond.equals;
    return presenceProps.has(cond.prop) ? v === PRESENCE_ON : v === 'true';
  };
  for (const trigger of constraining) {
    const hide = spell(trigger, [...sets.get(trigger)!]);
    if (!hide) continue;
    const restore: Array<{ prop: string; equals?: string }> = [];
    let ok = true;
    for (const other of constraining) {
      if (other === trigger) continue;
      const complement = valuesFor(other).filter((v) => !sets.get(other)!.has(v));
      const r = spell(other, complement);
      if (!r) { ok = false; break; }
      restore.push(...r);
    }
    if (!ok) continue;
    // VERIFY the cascade against every captured combo before carrying it.
    const verified = allCombos.every((c) => {
      const hidden = hide.some((h) => matches(h, c)) && !restore.some((r) => matches(r, c));
      return hidden === absentKeys.has(c.key);
    });
    if (!verified) continue;
    const fmt = (e: { prop: string; equals?: string }) => (e.equals !== undefined ? `${e.prop}=${e.equals}` : e.prop);
    return {
      hide,
      restore,
      receipts: [
        `presence-complement-carried: ${partName} absent in ${absent.length}/${allCombos.length} default-interaction combos — absence factors as a product; carried as ORDERED stylesWhen (hide on ${hide.map(fmt).join(', ')}${restore.length ? `; cascade-restored on ${restore.map(fmt).join(', ')}` : ''}) — verified against every captured combo (round 5c complement-of-product spelling)`,
      ],
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// SVG reconstruction from captured computed truth
// ---------------------------------------------------------------------------
/** Non-painting SVG metadata elements (SVG 1.1 §5.4 — "not rendered").
 *  They are real DOM elements with real text, so a naive reader captures
 *  them; nothing about them is anatomy. */
export const SVG_NONPAINTING = new Set(['title', 'desc', 'metadata']);

/** The four border sides, in CSS order. */
const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const;

/** CARBON LIVE-DEFECT ROUND (D2) — a PERCENTAGE corner radius resolved
 *  against the box. `border-radius: 50%` is how most libraries spell a
 *  circle, and computed style keeps it as a percentage: the px regex missed
 *  it, the radius folded to 0, and Carbon's round toggle knob would have
 *  compiled as a SQUARE (the same class of miss the `rounded-full`
 *  3.35544e+07px sentinel already covers for the other spelling). */
export function pctRadius(v: string | undefined, w: number, h: number): number | null {
  const m = /^(\d+(?:\.\d+)?)%$/.exec((v ?? '').trim());
  if (!m) return null;
  return (Number(m[1]) / 100) * Math.min(w, h);
}

const pxNum = (v: string | undefined): number | null => {
  if (!v) return null;
  const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v);
  return m ? Number(m[1]) : null;
};

/** Shared stroke-attribute reconstruction for path/circle children. */
function svgStrokeAttrs(
  el: CapturedNode,
  inheritedColor: string | undefined,
  receipts: string[],
  label: string,
  /** Path draw-on animation (pathLength-relative) drops dashes; progress
   *  rings bake absolute px dasharray/offset so determinate arcs survive. */
  dashMode: 'drop-pathlength' | 'bake-absolute',
): string {
  const strokeRaw = el.style['stroke'];
  const stroke = strokeRaw && inheritedColor && strokeRaw === inheritedColor ? 'currentColor' : strokeRaw;
  const strokeAttrs: string[] = [];
  if (!stroke || stroke === 'none') return '';
  strokeAttrs.push(` stroke="${stroke}"`);
  const sw = el.style['stroke-width'];
  const swNum = /^(-?\d+(?:\.\d+)?)px$/.exec(sw ?? '');
  if (swNum && Number(swNum[1]) !== 1) strokeAttrs.push(` stroke-width="${swNum[1]}"`);
  for (const [ch, attr] of [
    ['stroke-linecap', 'stroke-linecap'],
    ['stroke-linejoin', 'stroke-linejoin'],
  ] as const) {
    const v = el.style[ch];
    if (v && v !== 'butt' && v !== 'miter') strokeAttrs.push(` ${attr}="${v}"`);
  }
  const dash = el.style['stroke-dasharray'];
  const dashOffset = el.style['stroke-dashoffset'];
  if (dashMode === 'drop-pathlength') {
    // Round 5d (owner finding: the check glyph drew as SEGMENTED
    // CAPSULES, not a continuous check): dash channels are
    // pathLength-RELATIVE, and `pathLength` is an ATTRIBUTE — not a
    // computed style (the viewBox class). Polaris normalizes the
    // check path to pathLength=1 and drives stroke-dashoffset as a
    // draw-on animation; the computed 2px dasharray is the ANIMATION
    // VEHICLE, not resting geometry. Re-basing that pattern onto the
    // real ~14-user-unit path drew 2px capsules with joints. The
    // resting truth of a settled draw-on stroke is the CONTINUOUS
    // stroke — dash channels are dropped with a named receipt
    // (visibility still rides the captured opacity channel).
    if ((dash && dash !== 'none') || (dashOffset && dashOffset !== '0px')) {
      receipts.push(
        `svg-dash-channels-dropped: ${label} — stroke-dasharray ${dash || 'none'} / stroke-dashoffset ${dashOffset || '0px'} are pathLength-relative and pathLength is not a computed style (draw-on animation idiom); continuous stroke carried (named reconstruction)`,
      );
    }
  } else if (dash && dash !== 'none') {
    // WAVE 5 — MUI CircularProgress: dasharray/offset are absolute px
    // circumference fractions (determinate arc), not pathLength=1 animation.
    const dashNum = /^(-?\d+(?:\.\d+)?)px$/.exec(dash.trim());
    const offNum = /^(-?\d+(?:\.\d+)?)px$/.exec((dashOffset ?? '0px').trim());
    if (dashNum) {
      strokeAttrs.push(` stroke-dasharray="${dashNum[1]}"`);
      if (offNum) strokeAttrs.push(` stroke-dashoffset="${offNum[1]}"`);
      receipts.push(
        `svg-circle-dash-baked: ${label} — stroke-dasharray ${dash} / stroke-dashoffset ${dashOffset || '0px'} carried as absolute user units (progress-ring idiom; not pathLength-relative)`,
      );
    } else {
      receipts.push(
        `svg-circle-dash-unreadable: ${label} — stroke-dasharray ${dash} not px; dashes dropped`,
      );
    }
  }
  return strokeAttrs.join('');
}

/** Max |coord| from SVG path `d`, excluding elliptical-arc radii / flags.
 *  FC-SVG-VIEWBOX — A/a `rx ry x-rot large sweep x y`: only (x,y) count. */
export function pathDataExtent(d: string): number {
  let max = 0;
  const tokens = d.match(/[AaMmLlHhVvCcSsQqTtZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?/g) ?? [];
  let i = 0;
  let cmd = '';
  const take = (): number | null => {
    while (i < tokens.length && !/^-?\d/.test(tokens[i]) && tokens[i] !== '.' && !/^\.\d/.test(tokens[i])) {
      if (/^[AaMmLlHhVvCcSsQqTtZz]$/.test(tokens[i])) return null;
      i++;
    }
    if (i >= tokens.length) return null;
    const n = Number(tokens[i++]);
    return Number.isFinite(n) ? n : null;
  };
  const note = (n: number | null) => {
    if (n !== null) max = Math.max(max, Math.abs(n));
  };
  while (i < tokens.length) {
    const t = tokens[i];
    if (/^[AaMmLlHhVvCcSsQqTtZz]$/.test(t)) {
      cmd = t;
      i++;
    }
    if (!cmd) {
      i++;
      continue;
    }
    const c = cmd.toUpperCase();
    if (c === 'Z') {
      continue;
    }
    if (c === 'A') {
      take(); // rx
      take(); // ry
      take(); // x-axis-rotation
      take(); // large-arc
      take(); // sweep
      note(take()); // x
      note(take()); // y
      continue;
    }
    if (c === 'H' || c === 'V') {
      note(take());
      continue;
    }
    // M/L/T: pairs; C: 6; S/Q: 4
    const pairCount = c === 'C' ? 3 : c === 'S' || c === 'Q' ? 2 : 1;
    for (let p = 0; p < pairCount; p++) {
      note(take());
      note(take());
    }
  }
  return max;
}

/** Reconstruct inline SVG markup for one captured <svg> subtree. Returns
 *  null with a receipt when a child is outside the bounded grammar
 *  (path / g / circle). Round 5c: the result also carries the reconstructed
 *  viewBox number, the path-coordinate extent, and whether the viewBox was
 *  BUMPED past the computed size — the authored-viewBox unification pass
 *  (promoteAnatomy) needs all three to recognize one authored glyph captured
 *  at many sizes. Wave 5 adds `<circle>` so MUI CircularProgress (and peers)
 *  promote as assets instead of minting unregistered cx/cy/r/stroke channels. */
export function reconstructSvg(
  svgEl: CapturedNode,
  receipts: string[],
  label: string,
  /** Round 5c: prefer the currentColor spelling for fills equal to the
   *  inherited color — set ONLY when the fill==color identity holds in
   *  EVERY captured combo of this svg (a per-svg decision; a per-combo one
   *  splits one authored asset into per-variant markups — the Button icon
   *  regression this flag exists to prevent). */
  preferCurrentColor = false,
): { markup: string; size: number; vb: number; extent: number; bumped: boolean } | null {
  // A path fill equal to the svg's inherited `color` is CSS currentColor in
  // spirit — emitting it AS currentColor separates glyph SHAPE from color
  // (the Badge pip: shape = f(progress), color = f(tone); a baked fill made
  // the markup two-axis and refused the asset).
  const inheritedColor = svgEl.style['color'];
  const inheritedFill = svgEl.style['fill'];
  const w = pxNum(svgEl.style['width']);
  const h = pxNum(svgEl.style['height']);
  if (w === null || h === null || w <= 0 || h <= 0) {
    receipts.push(`svg-size-unreadable: ${label} — computed width/height not px; asset refused`);
    return null;
  }
  const paths: string[] = [];
  let maxCoord = 0;
  /** When every shape is a circle sharing one center, reconstruct the
   *  MUI-style offset viewBox (`SIZE/2 SIZE/2 SIZE SIZE`) instead of
   *  `0 0 vb vb` — otherwise cx=SIZE lands off-center in the display box. */
  let circleCenter: number | null = null;
  let circleOnly = true;
  const resolveFill = (fillRaw: string): string =>
    preferCurrentColor && fillRaw && inheritedColor && fillRaw === inheritedColor
      ? 'currentColor'
      : fillRaw && inheritedFill && fillRaw === inheritedFill
        ? ''
        : fillRaw && inheritedColor && fillRaw === inheritedColor
          ? 'currentColor'
          : fillRaw;
  const walkPaths = (n: CapturedNode): boolean => {
    for (const c of n.nodes) {
      if (c.t !== 'el') continue;
      const el = c.el;
      if (el.tag === 'path') {
        circleOnly = false;
        const dRaw = el.style['d'] ?? '';
        const m = /^path\("(.*)"\)$/.exec(dRaw);
        if (!m) {
          receipts.push(`svg-path-d-unreadable: ${label} — computed d "${dRaw.slice(0, 40)}"; asset refused`);
          return false;
        }
        const d = m[1];
        // FC-SVG-VIEWBOX: elliptical-arc radii (A/a rx ry …) can dwarf the
        // glyph's coordinate space (Polaris Banner warning: 20×20 icon with
        // A 449 radii → viewBox 450 → invisible at iconSize 20). Extent uses
        // endpoints / curve points only — not rx/ry.
        maxCoord = Math.max(maxCoord, pathDataExtent(d));
        const fill = resolveFill(el.style['fill'] ?? '');
        const fillRule = el.style['fill-rule'];
        const opacity = el.style['opacity'];
        // STROKE channels (round 4 fix: Polaris's checkmark is a STROKED
        // path — fill-only reconstruction rendered it invisible). Computed
        // px lengths convert to user units 1:1 (viewBox == computed size).
        const strokeAttrs = svgStrokeAttrs(el, inheritedColor, receipts, label, 'drop-pathlength');
        paths.push(
          `<path d="${d}"` +
            (fill ? ` fill="${fill}"` : '') +
            (fillRule === 'evenodd' ? ' fill-rule="evenodd"' : '') +
            (opacity && opacity !== '1' ? ` opacity="${opacity}"` : '') +
            strokeAttrs +
            '/>',
        );
      } else if (el.tag === 'circle') {
        const cx = pxNum(el.style['cx']);
        const cy = pxNum(el.style['cy']);
        const r = pxNum(el.style['r']);
        if (cx === null || cy === null || r === null || r <= 0) {
          receipts.push(`svg-circle-geometry-unreadable: ${label} — cx/cy/r not positive px; asset refused`);
          return false;
        }
        if (cx !== cy) circleOnly = false;
        else if (circleCenter === null) circleCenter = cx;
        else if (circleCenter !== cx) circleOnly = false;
        maxCoord = Math.max(maxCoord, Math.abs(cx) + r, Math.abs(cy) + r);
        const fillRaw = el.style['fill'] ?? '';
        const fill = fillRaw === 'none' ? 'none' : resolveFill(fillRaw);
        const opacity = el.style['opacity'];
        const strokeAttrs = svgStrokeAttrs(el, inheritedColor, receipts, label, 'bake-absolute');
        paths.push(
          `<circle cx="${cx}" cy="${cy}" r="${r}"` +
            (fill ? ` fill="${fill}"` : '') +
            (opacity && opacity !== '1' ? ` opacity="${opacity}"` : '') +
            strokeAttrs +
            '/>',
        );
      } else if (el.tag === 'g') {
        if (!walkPaths(el)) return false;
      } else if (SVG_NONPAINTING.has(el.tag)) {
        // CARBON LIVE-DEFECT ROUND (D1): <title>/<desc>/<metadata> are SVG
        // a11y METADATA — non-painting by spec. Refusing the asset over one
        // of them is what turned Carbon's notification glyph into a tree of
        // per-path parts with the accessible title rendered as canvas TEXT
        // ("error icon" next to the notification heading). The capture now
        // drops them at the source; this branch keeps ALREADY-COMMITTED
        // captures reconstructible instead of silently refused.
        receipts.push(`svg-metadata-skipped: ${label} — <${el.tag}> is non-painting SVG metadata (SVG 1.1 §5.4), skipped rather than refusing the asset`);
      } else {
        receipts.push(`svg-child-outside-grammar: ${label} — <${el.tag}> (v1 carries path/g/circle); asset refused`);
        return false;
      }
    }
    return true;
  };
  if (!walkPaths(svgEl)) return null;
  if (paths.length === 0) {
    receipts.push(`svg-empty: ${label} — no path/circle children; asset refused`);
    return null;
  }
  // viewBox reconstruction (NAMED): the viewBox attribute is not a computed
  // style — reconstructed as 0 0 W H from the svg's computed size, sanity-
  // checked against the path data's coordinate extent (a glyph drawn in a
  // larger user space than its box would silently crop). Circle-only MUI
  // progress rings use the authored offset form `SIZE/2 SIZE/2 SIZE SIZE`.
  if (circleOnly && circleCenter !== null && circleCenter > 0) {
    const size = Math.round(circleCenter);
    const origin = size / 2;
    receipts.push(
      `svg-viewbox-circle-offset: ${label} — ${origin} ${origin} ${size} ${size} from shared circle center ${circleCenter} (MUI CircularProgress idiom; viewBox is not a computed style — named reconstruction)`,
    );
    return {
      markup: `<svg viewBox="${origin} ${origin} ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`,
      size: Math.round(Math.max(w, h)),
      vb: size,
      extent: maxCoord,
      bumped: false,
    };
  }
  let vb = Math.round(Math.max(w, h));
  let bumped = false;
  if (maxCoord > vb * 1.02) {
    const bumpedVb = Math.ceil(maxCoord);
    receipts.push(`svg-viewbox-bumped: ${label} — computed size ${vb} < path extent ${maxCoord}; viewBox reconstructed as 0 0 ${bumpedVb} ${bumpedVb} (named reconstruction)`);
    vb = bumpedVb;
    bumped = true;
  } else {
    receipts.push(`svg-viewbox-reconstructed: ${label} — 0 0 ${vb} ${vb} from computed size ${w}×${h} (path extent ${maxCoord.toFixed(1)}; viewBox is not a computed style — named reconstruction)`);
  }
  return {
    markup: `<svg viewBox="0 0 ${vb} ${vb}" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`,
    size: Math.round(Math.max(w, h)),
    vb,
    extent: maxCoord,
    bumped,
  };
}

// ---------------------------------------------------------------------------
// Anatomy promotion
// ---------------------------------------------------------------------------
export interface PromotionResult {
  /** Static contract clone with computed-only parts PROMOTED at their
   *  captured nesting positions (and presence boolean props added). */
  contract: Contract;
  /** New icon assets: asset name → svg markup (run.ts writes the files). */
  assets: Map<string, string>;
  /** Union indices whose channels are CONSUMED by svg assets (the svg
   *  element and its descendants) — excluded from styled-channel minting. */
  consumed: Set<number>;
  /** partName → union index for every promoted or matched part. */
  partIndex: Map<string, number>;
  receipts: string[];
  /** Parts refused promotion, with named reasons. */
  refusals: string[];
}

const isEnabledCombo = (c: Combo): boolean => Object.values(c.stateFlags).every((f) => !f);

/** Whether a union entry is an svg subtree root whose parent is a
 *  single-purpose icon wrapper (span with only this svg child). */
function svgTarget(e: UnionNode): { host: UnionNode; svg: UnionNode } | null {
  if (e.rep.tag !== 'svg') return null;
  const parent = e.parent;
  if (
    parent &&
    parent.children.length === 1 &&
    parent.children[0] === e &&
    !parent.rep.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0)
  ) {
    return { host: parent, svg: e };
  }
  return e.parent ? { host: e, svg: e } : null;
}

export function promoteAnatomy(
  space: PropSpace,
  comp: ComponentConfig,
  union: UnionResult,
  componentKebab: string,
): PromotionResult {
  const receipts: string[] = [];
  const refusals: string[] = [];
  const assets = new Map<string, string>();
  /** ORPHAN-ASSET ROUND (task #42, second half) — asset name -> the union part
   *  that hosts it. The svg-asset door runs at the TOP of this function and the
   *  painting refusals (`non-painting-part`, `inert-overlay-wrapper`, …) run at
   *  the BOTTOM, so an asset could be reconstructed and committed for a part
   *  that never reaches the promoted contract. MEASURED:
   *  `examples/mui/assets/icons/autocomplete-autocomplete-clearindicator.svg`
   *  is written by promote-floor and referenced by no contract — its host
   *  `autocomplete-clearindicator` is refused `non-painting-part: renders NO
   *  INK in any combo it appears in (visibility: hidden)`. Same class of lie as
   *  the orphan minted leaf; fixed at the same door, below. */
  const assetOwner = new Map<string, string>();
  const consumed = new Set<number>();
  const contract = structuredClone(space.contract) as Contract;
  const entries = union.entries;
  const idxOf = new Map(entries.map((e, i) => [e.id, i] as const));
  const staticByName = new Map(walkAnatomy(contract).map((w) => [w.name, w.part] as const));
  const enabled = space.enumeration.combos.filter(isEnabledCombo);
  const presenceProps = new Set(space.presence.keys());
  const stateProps = space.stateProps.map((s) => s.prop);
  // Round 5f — OPTIONAL-ADORNMENT (defaultless structure-gating enum): any
  // defaultless enum axis that gates a part PRESENT-ONLY-WHEN-SET (a
  // factorPresence base-hidden `shownWhen` fact — the adornment is ABSENT at
  // unset and appears per SET value: Badge `progress` → the status pip) is
  // collected here. After the anatomy is built, each such axis materializes
  // its UNSET pseudo-value into the contract enum AS THE DEFAULT, so the emit
  // enumerates a PLAIN (adornment-absent) variant and the base-hidden part
  // renders nothing there. This extends the S2 unset-axis machinery from
  // STYLING to STRUCTURE (the round's spine). Booleans are NOT touched —
  // presence booleans already default OFF and expose a toggle; a defaultless
  // enum that only drives STYLING (Badge `tone`) is NOT collected (it gates
  // no part), so its unset stays the S2 styling base plane, not a variant.
  const structureGatingUnsetAxes = new Set<string>();

  // 1. presence boolean props (structure-creating optional props) join the
  //    contract's prop list.
  for (const pp of space.presence.values()) {
    if (contract.props.some((p) => p.name === pp.prop)) continue;
    contract.props.push({
      name: pp.prop,
      description: `Structure-creating optional prop promoted by the computed floor (round 4): ON mounts the library's \`${pp.libraryProp}\` (${JSON.stringify(pp.value).slice(0, 60)}); the created subtree is carried as parts gated on this prop.`,
      type: 'boolean',
      default: false,
      bindings: {
        figma: { kind: 'BOOLEAN', property: `Show ${pp.prop.charAt(0).toUpperCase()}${pp.prop.slice(1)}` },
        code: { prop: pp.prop },
      },
    } as Contract['props'][number]);
    receipts.push(`presence-prop-added: ${pp.prop} (boolean, default false; library prop ${pp.libraryProp})`);
  }

  // 2. presence facts per union entry (over enabled default-state captures).
  const presentBy = new Map<number, Combo[]>();
  for (const combo of enabled) {
    const els = union.alignedByKey.get(`${combo.key}__default`);
    if (!els) continue;
    entries.forEach((e, i) => {
      if (els[i]) (presentBy.get(i) ?? presentBy.set(i, []).get(i)!).push(combo);
    });
  }
  // Round 5c: presence over ALL default-interaction combos (state planes
  // included) — the complement-of-product spelling needs the full domain
  // (a disabled Tag renders the plain label even when linked).
  const allDefaultCombos = space.enumeration.combos.filter((c) => union.alignedByKey.has(`${c.key}__default`));
  const presentAllBy = new Map<number, Set<string>>();
  for (const combo of allDefaultCombos) {
    const els = union.alignedByKey.get(`${combo.key}__default`)!;
    entries.forEach((e, i) => {
      if (els[i]) (presentAllBy.get(i) ?? presentAllBy.set(i, new Set()).get(i)!).add(combo.key);
    });
  }

  // 3. svg targets: map host union index → per-combo markup.
  interface SvgPlan {
    hostIdx: number;
    /** value-keyed markup: axis prop + per-value assets, or single asset. */
    perValue: Array<{ value?: string; prop?: string; asset: string; size: number }>;
  }
  const svgPlans = new Map<number, SvgPlan>(); // host idx → plan
  const svgHostOf = new Map<number, number>(); // svg idx → host idx
  for (const e of entries) {
    const t = svgTarget(e);
    if (!t) continue;
    const hostIdx = idxOf.get(t.host.id)!;
    const svgIdx = idxOf.get(t.svg.id)!;
    if (svgPlans.has(hostIdx)) continue;
    svgHostOf.set(svgIdx, hostIdx);
    // per-combo markup over combos where the svg is present
    // Round 5c: the currentColor preference is a PER-SVG decision — the
    // fill==color identity must hold in EVERY present combo (see
    // reconstructSvg's preferCurrentColor doc).
    let identityEverywhere = true;
    for (const combo of presentBy.get(svgIdx) ?? []) {
      const el = union.alignedByKey.get(`${combo.key}__default`)![svgIdx];
      if (!el) continue;
      const st = el.node.style;
      if (!st['fill'] || !st['color'] || st['fill'] !== st['color']) { identityEverywhere = false; break; }
    }
    const markups = new Map<string, { markup: string; size: number; vb: number; extent: number; bumped: boolean }>(); // comboKey → markup
    for (const combo of presentBy.get(svgIdx) ?? []) {
      const els = union.alignedByKey.get(`${combo.key}__default`)!;
      const el = els[svgIdx];
      if (!el) continue;
      const r = reconstructSvg(el.node, receipts, `${comp.name}.${t.host.partName}@${combo.key}`, identityEverywhere);
      if (r) markups.set(combo.key, r);
    }
    if (markups.size === 0) continue;
    // Round 5c — AUTHORED-VIEWBOX unification: one authored glyph captured
    // at several sizes carries IDENTICAL path data; the reconstruction can
    // only see the authored user space at the size whose computed box bounds
    // the path extent (Avatar Xl: 40 ≥ 38.6 — exact on the canvas gate).
    // Smaller captures were BUMPED to ceil(extent) — a guess the package
    // contradicts. Group by path data; when a group has an UNBUMPED member
    // whose viewBox bounds every member's extent, bumped members adopt that
    // authored space (receipted; per-size stroke widths stay captured truth).
    {
      const dOf = (m: string) => (m.match(/ d="[^"]*"/g) ?? []).join('|');
      const byPath = new Map<string, Array<{ key: string; r: { markup: string; size: number; vb: number; extent: number; bumped: boolean } }>>();
      for (const [k, r] of markups) {
        const sig = dOf(r.markup);
        (byPath.get(sig) ?? byPath.set(sig, []).get(sig)!).push({ key: k, r });
      }
      for (const group of byPath.values()) {
        if (group.length < 2) continue;
        const anchors = group.filter((g) => !g.r.bumped);
        if (anchors.length === 0) continue;
        const cand = Math.max(...anchors.map((g) => g.r.vb));
        for (const g of group) {
          if (!g.r.bumped || g.r.vb === cand) continue;
          if (cand < g.r.extent) continue; // the authored space must bound the paths
          receipts.push(
            `svg-viewbox-unified: ${comp.name}.${t.host.partName}@${g.key} — bumped 0 0 ${g.r.vb} ${g.r.vb} adopts the sibling capture's authored space 0 0 ${cand} ${cand} (identical path data drawn where the computed box bounds the extent — the package's own viewBox; round 5c)`,
          );
          g.r.markup = g.r.markup.replace(/viewBox="0 0 [\d.]+ [\d.]+"/, `viewBox="0 0 ${cand} ${cand}"`);
          g.r.vb = cand;
        }
      }
    }
    // correlate: uniform | single-axis | refuse
    const distinct = new Map<string, string[]>(); // markup → combo keys
    for (const [k, m] of markups) (distinct.get(m.markup) ?? distinct.set(m.markup, []).get(m.markup)!).push(k);
    const kebabValue = (v: string) => v.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    if (distinct.size === 1) {
      const name = `${componentKebab}-${kebabValue(t.host.partName)}`;
      assets.set(name, [...markups.values()][0].markup);
      assetOwner.set(name, t.host.partName);
      svgPlans.set(hostIdx, { hostIdx, perValue: [{ asset: name, size: [...markups.values()][0].size }] });
    } else {
      // single-axis explanation: find an axis whose value partitions markup
      const comboByKey = new Map(enabled.map((c) => [c.key, c] as const));
      const axis = space.axes.find((ax) => {
        const byValue = new Map<string, Set<string>>();
        for (const [k, m] of markups) {
          const v = comboByKey.get(k)!.axisValues[ax.prop];
          (byValue.get(v) ?? byValue.set(v, new Set()).get(v)!).add(m.markup);
        }
        return [...byValue.values()].every((s) => s.size === 1);
      });
      if (!axis) {
        refusals.push(`svg-content-multi-axis: ${comp.name}.${t.host.partName} — markup varies over more than one axis; asset refused (part still promoted as a box)`);
        continue;
      }
      const perValue: SvgPlan['perValue'] = [];
      const seenValues = new Set<string>();
      for (const [k, m] of markups) {
        const v = comboByKey.get(k)!.axisValues[axis.prop];
        if (seenValues.has(v)) continue;
        seenValues.add(v);
        const name = `${componentKebab}-${kebabValue(t.host.partName)}-${kebabValue(v)}`;
        assets.set(name, m.markup);
        assetOwner.set(name, t.host.partName);
        perValue.push({ value: v, prop: axis.prop, asset: name, size: m.size });
      }
      svgPlans.set(hostIdx, { hostIdx, perValue });
    }
    // consume the svg subtree. When the svg IS the host (no dedicated
    // wrapper), its OWN channels stay mintable — the per-tone fill cascades
    // to attribute-less paths in CSS; only descendants are consumed.
    const consume = (u: UnionNode) => {
      consumed.add(idxOf.get(u.id)!);
      for (const c of u.children) consume(c);
    };
    if (t.host === t.svg) {
      for (const c of t.svg.children) consume(c);
    } else {
      consume(t.svg);
    }
  }

  // 4. build the promoted anatomy tree in union order.
  const rootEntry = entries[0];
  const rootPart = contract.anatomy['root'];
  if (!rootPart) throw new Error(`${comp.name}: contract has no root anatomy part`);
  const partIndex = new Map<string, number>();

  const textOf = (n: CapturedNode): string =>
    n.nodes.filter((c) => c.t === 'text').map((c) => (c as { v: string }).v).join('').trim();
  const samplesByProp = new Map<string, string>();
  for (const p of contract.props) {
    if (p.type !== 'text') continue;
    if (p.bindings.code.prop === 'children') samplesByProp.set(p.name, comp.sampleText);
    else {
      const fixed = comp.fixedProps?.[p.name];
      if (typeof fixed === 'string') samplesByProp.set(p.name, fixed);
    }
  }

  /** Apply a compiled svg plan onto a HOST part: single asset → Part.icon;
   *  per-value assets → per-value icon child parts. Round 5c: extracted so
   *  the ROOT can host a plan too (Spinner's glyph is the root's only child
   *  — buildPart never runs on the root, and the plan silently dropped). */
  const applySvgPlan = (part: Part, e: UnionNode, plan: SvgPlan): void => {
    if (e.rep.tag === 'svg') delete part.element; // icon parts render their own <svg> from the asset
    if (plan.perValue.length === 1 && plan.perValue[0].value === undefined) {
      part.icon = { asset: plan.perValue[0].asset, size: plan.perValue[0].size };
      // the host element wraps the glyph; its own element stays
      return;
    }
    // per-value icon parts nested under the host box part (names prefixed
    // by the host part — part names are contract-global). A glyph keyed by
    // the UNSET pseudo-value of a defaultless axis is the DEFAULT glyph:
    // visible unless a set value applies (stylesWhen display:none per set
    // value — the pseudo-value is not a contract enum value).
    part.parts = { ...part.parts };
    for (const pv of plan.perValue) {
      const axisSpec = space.axes.find((ax) => ax.prop === pv.prop);
      const isUnsetValue = axisSpec?.unset !== undefined && pv.value === axisSpec.unset;
      const child: Part = {
        icon: { asset: pv.asset, size: pv.size },
        ...(isUnsetValue
          ? {
              stylesWhen: axisSpec!.values
                .filter((v) => v !== axisSpec!.unset)
                .map((v) => ({ prop: pv.prop!, equals: v, styles: { display: 'none' } })),
            }
          : { visibleWhen: { prop: pv.prop!, equals: pv.value } }),
        description: `Per-value svg content promoted from the computed floor: the glyph drawn when ${pv.prop}=${isUnsetValue ? `unset (default)` : pv.value}.`,
      };
      part.parts[`${e.partName}-${pv.value!.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`] = child;
    }
  };

  /** Round 5c — S5 first real slice: DRAWN pseudo-element DECOR BOXES
   *  promote as shape parts (the RadioButton ::before selected dot). The
   *  floor's read includes ::before/::after; until now every finding was
   *  extension residue. Bounded v1 grammar, everything else refuses by name:
   *    · content must be the empty string (a decor box, never text ink);
   *    · the box must be DRAWN: opaque-ish background (alpha > 0), opacity
   *      > 0.05, positive px box, position:absolute, and any transform a
   *      pure translate at scale ≈ 1 (a scale-0/opacity-0 pseudo is the
   *      component's own hidden state — that combo counts as NOT drawn);
   *    · geometry + fill must be UNIFORM across every drawn enabled combo
   *      (translate folds into top/left, receipted);
   *    · visibility must factor per-axis (factorPresence), and placement
   *      needs an enum condition to ride stylesWhen — the v9 shape grammar
   *      the canvas already compiles (position/top/left per combo).
   */
  /** When the host part is a SHAPE LEAF (curated backdrop), the decor cannot
   *  nest inside it (shape parts refuse children) — it BUBBLES to the host's
   *  parent, offsets folded with the host's border widths, guarded by a
   *  geometry assertion: the parent's content box must equal the host's
   *  border box (else named refusal). */
  const pseudoDecorParts = (e: UnionNode, i: number, hostIsShapeLeaf: boolean): Array<[string, Part]> => {
    const out: Array<[string, Part]> = [];
    const px = (v: string | undefined): number | null => {
      const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
      return m ? Number(m[1]) : null;
    };
    const alphaOf = (v: string | undefined): number => {
      const m = /^rgba\(\d+, \d+, \d+, ([\d.]+)\)$/.exec(v ?? '');
      return m ? Number(m[1]) : 0;
    };
    for (const pe of DECOR_PSEUDOS) {
      // Domain: ALL default-interaction combos where the host renders (state
      // planes included — a disabled checked Radio keeps its dot; an
      // enabled-only domain would fabricate a hidden-when-disabled fact).
      const domain = allDefaultCombos.filter((combo) => union.alignedByKey.get(`${combo.key}__default`)![i]);
      const drawnRows: Array<{ combo: Combo; st: Record<string, string> }> = [];
      // SILENT-LOSS ROUND (task #33, fix 2) — THE TWO BARE `continue`s.
      //
      // Both of the skips in this loop used to be silent, and between them
      // they hid EVERY un-promoted pseudo-element:
      //
      //   · `content !== '""'` — text/glyph-bearing pseudo content, i.e.
      //     every ICON-FONT GLYPH. `content: "\ea01"` is how Bootstrap,
      //     FontAwesome and Material ligature sets draw carets, chevrons and
      //     close ×s. The grammar cannot promote one, which is fine; saying
      //     nothing about it is not.
      //   · `!drawn` — which CONFLATED two completely different facts:
      //     "legitimately hidden in this combo" (the component's own
      //     scale-0/opacity-0 hidden state — normal, expected, not a loss)
      //     with "painted by something the grammar cannot read"
      //     (position:static/relative decor, gradient/shadow/outline-only
      //     paint, opacity in (0, 0.05]). The second is exactly the shape of
      //     Carbon's hollow checkbox, and this is the change that would have
      //     caught it on its FIRST run.
      //
      // The two are reported under DIFFERENT names on purpose — a hidden
      // state is not a limit, and a limit is not a hidden state.
      const notDrawn = new Map<string, string>(); // reason-key -> message (deduped per part/pseudo)
      for (const combo of domain) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        const st = el?.node.pseudo[pe];
        if (!st) continue;
        if (st['content'] !== '""') {
          notDrawn.set('content', `pseudo-content-not-canvas-ink: ${e.partName}${pe} carries content ${st['content']} — the bounded decor grammar promotes EMPTY-content decor boxes only. A glyph drawn by an icon-font ligature (Bootstrap/FontAwesome/Material carets, chevrons, close ×s) is real ink that does NOT reach the canvas; named refusal`);
          continue;
        }
        const w = px(st['width']);
        const h = px(st['height']);
        const opacity = Number(st['opacity'] ?? '1');
        const alpha = alphaOf(st['background-color']);
        const t = st['transform'] ?? 'none';
        const mtx = /^matrix\((-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)$/.exec(t);
        const m = mtx
          ? {
              a: Number(mtx[1]),
              b: Number(mtx[2]),
              c: Number(mtx[3]),
              d: Number(mtx[4]),
              e: Number(mtx[5]),
              f: Number(mtx[6]),
            }
          : null;
        // Wave B.2 — TRANSFORM CARRIAGE (Carbon checkbox ::after live finding).
        // v1 allowed translate-only (identity linear part). That refused the
        // whole pseudo when ANY combo used scale(0) to hide the check, even
        // though checked/indeterminate draw a readable L-bar / minus with an
        // orthonormal rotate. Zero-scale is the component's OWN hidden state
        // (same class as opacity:0); orthonormal rotate is canvas-native
        // (`shape.rotation` / stylesWhen `rotate(<n>deg)`).
        const col1 = m ? Math.hypot(m.a, m.b) : 1;
        const col2 = m ? Math.hypot(m.c, m.d) : 1;
        const isZeroScale = m !== null && col1 < 0.02 && col2 < 0.02;
        const isTranslateOnly =
          t === 'none' ||
          (m !== null &&
            Math.abs(m.b) < 0.01 &&
            Math.abs(m.c) < 0.01 &&
            Math.abs(m.a - 1) < 0.01 &&
            Math.abs(m.d - 1) < 0.01);
        const isOrthonormalRotate =
          m !== null &&
          !isZeroScale &&
          Math.abs(col1 - 1) < 0.03 &&
          Math.abs(col2 - 1) < 0.03 &&
          Math.abs(m.a * m.c + m.b * m.d) < 0.03;
        const transformOk = isTranslateOnly || isOrthonormalRotate;
        // PSEUDO-DECOR v2 (CARBON LIVE-DEFECT ROUND, D2) — DRAWN MEANS PAINTS
        // ANYTHING. v1 required an opaque-ish BACKGROUND, so a box made of a
        // RING was invisible to the grammar: an unchecked Carbon checkbox is
        // `background: transparent; border: 1px solid #161616`, and refusing
        // it is why the live canvas showed a checkbox with no box at all.
        const maxBorder = Math.max(...BORDER_SIDES.map((s) => px(st[`border-${s}-width`]) ?? 0));
        const borderAlpha = alphaOf(st['border-top-color']);
        const paints = alpha > 0 || (maxBorder > 0 && borderAlpha > 0);
        const drawn = paints && opacity > 0.05 && w !== null && h !== null && w > 0 && h > 0 && st['position'] === 'absolute';
        if (!drawn || isZeroScale) {
          // fix 2: name WHICH of the two it is, and MEASURE it.
          const pos = st['position'] ?? '(unset)';
          const zeroBox = w === null || h === null || w <= 0 || h <= 0;
          const hasGradient = (st['background-image'] ?? 'none') !== 'none';
          const hasShadow = (st['box-shadow'] ?? 'none') !== 'none';
          const outlineW = px(st['outline-width']) ?? 0;
          const hasOutline = outlineW > 0 && (st['outline-style'] ?? 'none') !== 'none';
          if (isZeroScale || opacity === 0 || zeroBox) {
            // the component's OWN hidden state for this combo — expected,
            // and NOT a limit of the grammar. Named separately so it can
            // never be mistaken for one. scale(0) is Carbon's checkbox
            // unchecked ::after hide (Wave B.2).
            notDrawn.set(
              'hidden',
              `pseudo-decor-hidden-in-combo: ${e.partName}${pe} is not drawn in every combo (${isZeroScale ? `transform ${t} (scale 0)` : `opacity ${opacity}, box ${w ?? 'null'}x${h ?? 'null'}`}) — the component's own hidden state, NOT a grammar limit`,
            );
          } else if (pos !== 'absolute') {
            notDrawn.set('position', `pseudo-decor-outside-grammar: ${e.partName}${pe} paints at position:${pos} (${w}x${h}, opacity ${opacity}) — the bounded decor grammar reads position:absolute boxes only; an in-flow decor box is NOT promoted and NOT on the canvas`);
          } else if (!paints && (hasGradient || hasShadow || hasOutline)) {
            const how = [hasGradient ? `background-image: ${st['background-image']}` : null, hasShadow ? `box-shadow: ${st['box-shadow']}` : null, hasOutline ? `outline: ${outlineW}px ${st['outline-style']}` : null].filter(Boolean).join('; ');
            notDrawn.set('paint', `pseudo-decor-outside-grammar: ${e.partName}${pe} is painted by a mechanism the grammar cannot read (${how}) — the decor grammar reads background-color alpha and border rings only; the box is NOT promoted`);
          } else if (!paints) {
            notDrawn.set('paint', `pseudo-decor-outside-grammar: ${e.partName}${pe} occupies ${w}x${h} at position:absolute but paints nothing the grammar reads (background-color ${st['background-color'] ?? '(unset)'}, border ${maxBorder}px ${st['border-top-color'] ?? '(unset)'}) — NOT promoted`);
          } else if (opacity <= 0.05) {
            notDrawn.set('opacity', `pseudo-decor-outside-grammar: ${e.partName}${pe} paints at opacity ${opacity} — inside the (0, 0.05] band the grammar treats as not-drawn. That band cannot tell a nearly-invisible DECOR box from a hidden state; named refusal rather than a guess`);
          }
          continue;
        }
        if (!transformOk) {
          refusals.push(`pseudo-decor-outside-grammar: ${e.partName}${pe} drawn with a non-carryable transform (${t}) — the bounded decor grammar carries translate + orthonormal rotate only; named refusal`);
          drawnRows.length = 0;
          break;
        }
        drawnRows.push({ combo, st });
      }
      if (drawnRows.length === 0) {
        // fix 2: nothing promoted for this pseudo — say why, by name. (When
        // SOME combos drew, the promotion proceeds and the per-combo notes
        // are the domain's own hidden-state facts, already carried by
        // factorPresence.)
        for (const msg of [...notDrawn.values()].sort()) refusals.push(msg);
        continue;
      }
      // uniform geometry + fill over the drawn combos (translate folded)
      // Bubbled decor: offsets are parent-relative — fold the HOST's border
      // widths in (absolute children position against the PADDING box) and
      // assert the parent's content box equals the host's border box.
      if (hostIsShapeLeaf) {
        let geometryOk = e.parent !== null;
        for (const { combo } of drawnRows) {
          const els = union.alignedByKey.get(`${combo.key}__default`)!;
          const host = els[i];
          const parent = e.parent ? els[idxOf.get(e.parent.id)!] : null;
          if (!host || !parent) { geometryOk = false; break; }
          const hs = host.node.style;
          const pst = parent.node.style;
          const num = (v: string | undefined) => px(v) ?? 0;
          const parentContentW = num(pst['width']) - num(pst['padding-left']) - num(pst['padding-right']) - num(pst['border-left-width']) - num(pst['border-right-width']);
          const parentContentH = num(pst['height']) - num(pst['padding-top']) - num(pst['padding-bottom']) - num(pst['border-top-width']) - num(pst['border-bottom-width']);
          if (
            Math.abs(parentContentW - num(hs['width'])) > 0.6 ||
            Math.abs(parentContentH - num(hs['height'])) > 0.6 ||
            num(hs['margin-top']) !== 0 || num(hs['margin-left']) !== 0
          ) { geometryOk = false; break; }
        }
        if (!geometryOk) {
          refusals.push(`pseudo-decor-bubble-geometry: ${e.partName}${pe} — the host is a shape leaf (cannot nest children) and the parent's content box does not equal the host's border box; decor NOT promoted (named refusal, v1 bounded)`);
          continue;
        }
      }
      const fold = (row: { combo: Combo; st: Record<string, string> }) => {
        const t = row.st['transform'] ?? 'none';
        const mtx = /^matrix\((-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)$/.exec(t);
        const tx = mtx ? Number(mtx[5]) : 0;
        const ty = mtx ? Number(mtx[6]) : 0;
        // CSS matrix(a,b,c,d,e,f): column1=(a,b)= (cosθ, sinθ). Degrees are
        // what emit's stylesWhen `rotate(<n>deg)` / shape.rotation expect.
        const rot =
          mtx && !(Math.abs(Number(mtx[2])) < 0.01 && Math.abs(Number(mtx[3])) < 0.01)
            ? (Math.atan2(Number(mtx[2]), Number(mtx[1])) * 180) / Math.PI
            : 0;
        // Bubbled: absolute children position against the host's PADDING box
        // — the host's border widths join the parent-relative offsets.
        const hostSt = hostIsShapeLeaf ? union.alignedByKey.get(`${row.combo.key}__default`)![i]!.node.style : null;
        const bT = hostSt ? (px(hostSt['border-top-width']) ?? 0) : 0;
        const bL = hostSt ? (px(hostSt['border-left-width']) ?? 0) : 0;
        const w = px(row.st['width'])!;
        const h = px(row.st['height'])!;
        const borderW = Object.fromEntries(BORDER_SIDES.map((s) => [s, px(row.st[`border-${s}-width`]) ?? 0])) as Record<string, number>;
        const sideColors = BORDER_SIDES.map((s) => row.st[`border-${s}-color`] ?? '');
        return {
          w,
          h,
          top: (px(row.st['top']) ?? 0) + ty + bT,
          left: (px(row.st['left']) ?? 0) + tx + bL,
          rot: Math.round(rot * 1000) / 1000,
          bg: row.st['background-color'],
          borderW,
          // ONE Figma stroke paint. Prefer the color of SIDES THAT INK
          // (width > 0): Carbon's checkbox ::after check is white on
          // left+bottom and dark on zero-width top+right — requiring all
          // four colors to agree dropped the stroke entirely (Wave B.2).
          borderColor: (() => {
            const ink = BORDER_SIDES.filter((s) => borderW[s] > 0).map((s) => row.st[`border-${s}-color`] ?? '');
            if (ink.length > 0 && new Set(ink).size === 1) return ink[0];
            if (new Set(sideColors).size === 1 && Math.max(...Object.values(borderW)) > 0) return sideColors[0];
            return '';
          })(),
          // PSEUDO-DECOR v2 (G3) — SQUARE-THUMB TRAP. `rounded-full` computes
          // to 3.35544e+07px, which the local px() regex does not match, so
          // the radius folded to 0 and the decor shipped as a RECT. Share the
          // pill sentinel fuse.ts already uses for minted radii; the kind rule
          // below (radius ≥ min(w,h)/2) then correctly reads it as an ellipse.
          // CARBON (D2): a PERCENTAGE radius is the third spelling of the same
          // idea — Carbon's toggle knob is `border-radius: 50%`, which the px
          // regex also missed, so the round knob compiled as a SQUARE.
          radius: isAbsurdRadius(row.st['border-top-left-radius'])
            ? parseFloat(PILL_RADIUS_SENTINEL)
            : (pctRadius(row.st['border-top-left-radius'], w, h) ?? px(row.st['border-top-left-radius']) ?? 0),
        };
      };
      type Folded = ReturnType<typeof fold>;
      const folded = drawnRows.map(fold);
      // PSEUDO-DECOR v2 (D2) — GEOMETRY and PAINT are factored SEPARATELY.
      //
      // v1 hashed the whole box (size + offsets + fill + radius) into one key
      // and refused anything non-uniform. Both hollow Carbon components died
      // there, and for two DIFFERENT reasons that the one refusal hid:
      //   · the CHECKBOX box has IDENTICAL geometry in all six combos and
      //     only its PAINT moves (transparent+ring when unchecked, filled
      //     when checked, quarter-alpha when disabled);
      //   · the TOGGLE knob has identical PAINT in the enabled plane and only
      //     its LEFT offset moves (3px → 27px with `toggled`).
      // Neither is the two-axis GEOMETRY product named in
      // examples/tailwind/PROVENANCE.md (Size × Toggled knob offsets) — that
      // wall is still here and still refuses, below.
      const enumAxes = space.axes.filter(
        (a) => !presenceProps.has(a.prop) && !stateProps.includes(a.prop) && contract.props.some((p) => p.name === a.prop),
      );
      const isEnabledCombo = (c: Combo) => Object.values(c.stateFlags).every((v) => v !== true);
      const enabledDrawn = drawnRows.map((r, k) => ({ ...r, f: folded[k] })).filter((r) => isEnabledCombo(r.combo));
      const rowsForFactoring = enabledDrawn.length > 0 ? enabledDrawn : drawnRows.map((r, k) => ({ ...r, f: folded[k] }));
      /** Uniform, or a function of exactly ONE enum axis. null = neither. */
      const factorByAxis = <T>(
        rows: Array<{ combo: Combo; f: Folded }>,
        valueOf: (f: Folded) => T,
      ): { kind: 'uniform'; value: T } | { kind: 'axis'; prop: string; map: Map<string, T> } | null => {
        const keys = rows.map((r) => JSON.stringify(valueOf(r.f)));
        if (new Set(keys).size === 1) return { kind: 'uniform', value: valueOf(rows[0].f) };
        for (const ax of enumAxes) {
          const byVal = new Map<string, string>();
          let ok = true;
          for (let k = 0; k < rows.length; k++) {
            const v = rows[k].combo.axisValues[ax.prop];
            if (v === undefined) { ok = false; break; }
            const prev = byVal.get(v);
            if (prev === undefined) byVal.set(v, keys[k]);
            else if (prev !== keys[k]) { ok = false; break; }
          }
          if (ok && new Set(byVal.values()).size > 1) {
            const map = new Map<string, T>();
            for (let k = 0; k < rows.length; k++) {
              const v = rows[k].combo.axisValues[ax.prop];
              if (!map.has(v)) map.set(v, valueOf(rows[k].f));
            }
            return { kind: 'axis', prop: ax.prop, map };
          }
        }
        return null;
      };
      // Wave B.1 — OFFSETS, SIZE, and PAINT factor separately (same
      // factorByAxis pattern). Offsets used to bundle width/height, so a
      // thumb that only resized by `sizing` (Tailwind ToggleSwitch ::after
      // at 16/20/24) was refused as if it needed a multi-axis geometry
      // product. Size may now factor by exactly ONE enum axis; the base
      // shape keeps the axis-default intrinsic size and per-value
      // width/height ride `literalsByProp` (emit syncs those onto shape
      // before resize). A size that does not factor — or an offset product
      // across two axes — still refuses by name.
      const offsetOf = (f: Folded) => ({ top: f.top, left: f.left });
      const sizeOf = (f: Folded) => ({ w: f.w, h: f.h });
      const paintOf = (f: Folded) => ({ bg: f.bg, borderW: f.borderW, borderColor: f.borderColor, radius: f.radius });
      const rotOf = (f: Folded) => f.rot;
      const geomFact = factorByAxis(rowsForFactoring, offsetOf);
      if (!geomFact) {
        refusals.push(
          `pseudo-decor-geometry-multiaxis: ${e.partName}${pe} drawn offsets vary across the enabled combos and do not factor as a function of ONE enum axis (${[...new Set(rowsForFactoring.map((r) => JSON.stringify(offsetOf(r.f))))].join(' vs ')}) — the two-axis geometry product named in examples/tailwind/PROVENANCE.md; named refusal`,
        );
        continue;
      }
      const sizeFact = factorByAxis(rowsForFactoring, sizeOf);
      if (!sizeFact) {
        refusals.push(
          `pseudo-decor-size-varies: ${e.partName}${pe} drawn at ${[...new Set(rowsForFactoring.map((r) => `${r.f.w}×${r.f.h}`))].join(' vs ')} — size does not factor as a function of ONE enum axis (per-variant resize spelling is literalsByProp width/height on a single axis); named refusal`,
        );
        continue;
      }
      const paintFact = factorByAxis(rowsForFactoring, paintOf);
      if (!paintFact) {
        refusals.push(
          `pseudo-decor-paint-multiaxis: ${e.partName}${pe} drawn paint varies across the enabled combos and does not factor as a function of ONE enum axis (${[...new Set(rowsForFactoring.map((r) => JSON.stringify(paintOf(r.f))))].join(' vs ')}); named refusal`,
        );
        continue;
      }
      // Wave B.2 — rotation factors like paint (Carbon check ≈ −45°, minus = 0°).
      const rotFact = factorByAxis(rowsForFactoring, rotOf);
      if (!rotFact) {
        refusals.push(
          `pseudo-decor-rotation-multiaxis: ${e.partName}${pe} drawn rotation varies across the enabled combos and does not factor as a function of ONE enum axis (${[...new Set(rowsForFactoring.map((r) => String(rotOf(r.f))))].join(' vs ')}); named refusal`,
        );
        continue;
      }
      // STATE-PLANE residue, NAMED not dropped: whatever the disabled plane
      // paints differently is not carried by the decor part (the contract's
      // `states` slot takes TOKEN REFS and this decor carries literals, so a
      // per-enum-value × per-state product has no spelling). The enabled
      // plane is what the canvas draws; the difference is printed.
      for (const r of drawnRows.map((rr, k) => ({ ...rr, f: folded[k] }))) {
        if (isEnabledCombo(r.combo)) continue;
        const twin = rowsForFactoring.find((x) =>
          enumAxes.every((ax) => x.combo.axisValues[ax.prop] === r.combo.axisValues[ax.prop]),
        );
        if (!twin) continue;
        if (JSON.stringify(paintOf(twin.f)) !== JSON.stringify(paintOf(r.f))) {
          refusals.push(
            `pseudo-decor-state-paint-uncarried: ${e.partName}${pe} at ${r.combo.key} paints ${JSON.stringify(paintOf(r.f))} where the matching enabled combo paints ${JSON.stringify(paintOf(twin.f))} — the decor carries the ENABLED plane; a per-enum-value × per-state paint product has no contract spelling (states take token refs, decor paint is literal); named residue`,
          );
        }
        if (
          JSON.stringify(offsetOf(twin.f)) !== JSON.stringify(offsetOf(r.f)) ||
          JSON.stringify(sizeOf(twin.f)) !== JSON.stringify(sizeOf(r.f))
        ) {
          refusals.push(
            `pseudo-decor-state-geometry-uncarried: ${e.partName}${pe} at ${r.combo.key} sits at ${JSON.stringify({ ...sizeOf(r.f), ...offsetOf(r.f) })} vs the enabled ${JSON.stringify({ ...sizeOf(twin.f), ...offsetOf(twin.f) })}; named residue`,
          );
        }
      }
      const f = rowsForFactoring[0].f;
      const baseValueOf = (prop: string): string => {
        const ax = space.axes.find((a) => a.prop === prop)!;
        const decl = contract.props.find((p) => p.name === prop)?.default;
        return decl !== undefined ? String(decl) : (ax.values.find((v) => v !== ax.unset) ?? ax.values[0]);
      };
      let baseSize = sizeOf(f);
      if (sizeFact.kind === 'axis') {
        baseSize = sizeFact.map.get(baseValueOf(sizeFact.prop)) ?? [...sizeFact.map.values()][0];
      }
      // presence over the enabled domain: drawn combos only
      const fact = factorPresence(
        drawnRows.map((r) => r.combo),
        domain,
        space.axes,
        presenceProps,
        stateProps,
        `${e.partName}${pe}`,
        new Set(contract.props.map((p) => p.name)),
      );
      if (!fact) {
        refusals.push(`pseudo-decor-presence-uncorrelated: ${e.partName}${pe} drawn in ${drawnRows.length}/${domain.length} default-interaction combos and the drawn set does not factor per-axis — decor NOT promoted (named refusal)`);
        continue;
      }
      if (fact.shownWhen.length > 0) {
        refusals.push(`pseudo-decor-unset-axis-gate: ${e.partName}${pe} is gated by a defaultless axis (base-hidden spelling) — outside the bounded v1 decor grammar; named refusal`);
        continue;
      }
      // placement rides stylesWhen (the v9 shape grammar) — it needs enum
      // conditions to hang on; the shown values of the constraining enum
      // axis provide them. Drawn-everywhere boxes have no condition slot.
      const placementConds: Array<{ prop: string; equals: string }> = [];
      const hiddenEnum = fact.hiddenWhen.filter((hw) => hw.equals !== undefined);
      if (hiddenEnum.length > 0) {
        const ax = space.axes.find((a) => a.prop === hiddenEnum[0].prop)!;
        const hiddenVals = new Set(hiddenEnum.filter((hw) => hw.prop === ax.prop).map((hw) => hw.equals!));
        for (const v of ax.values) {
          if (v === ax.unset || hiddenVals.has(v)) continue;
          placementConds.push({ prop: ax.prop, equals: v });
        }
      }
      const partName = `${e.partName}-${pe.slice(2)}`;
      const kind: 'ellipse' | 'rect' = f.radius >= Math.min(baseSize.w, baseSize.h) / 2 - 0.5 ? 'ellipse' : 'rect';
      /** Paint channels as contract literals. */
      const paintLits = (p: ReturnType<typeof paintOf>): Record<string, string> => {
        const out: Record<string, string> = {
          'background-color': alphaOf(p.bg) === 0 ? 'transparent' : p.bg,
        };
        // Always write every side's width (incl. 0px) so per-value paint maps
        // OVERRIDE base literals — Carbon indeterminate must clear the
        // checked left border or the minus reads as an L (Wave B.2 residual).
        for (const s of BORDER_SIDES) {
          out[`border-${s}-width`] = `${p.borderW[s]}px`;
        }
        if (p.borderColor) {
          for (const s of BORDER_SIDES) {
            if (p.borderW[s] > 0) out[`border-${s}-color`] = p.borderColor;
          }
        }
        // A rect keeps its corner radius; an ellipse IS the radius.
        if (kind === 'rect' && p.radius > 0) out['border-radius'] = `${p.radius}px`;
        return out;
      };
      const geomLits = (g: ReturnType<typeof offsetOf>): Record<string, string> => ({ top: `${g.top}px`, left: `${g.left}px` });
      const sizeLits = (s: ReturnType<typeof sizeOf>): Record<string, string> => ({ width: `${s.w}px`, height: `${s.h}px` });
      const mergeByProp = (
        byProp: Array<{ prop: string; map: Record<string, Record<string, string>> }>,
        prop: string,
        map: Record<string, Record<string, string>>,
      ) => {
        const entry = byProp.find((b) => b.prop === prop);
        if (entry) for (const [v, m] of Object.entries(map)) entry.map[v] = { ...entry.map[v], ...m };
        else byProp.push({ prop, map });
      };
      const sizeReceipt = sizeFact.kind === 'axis' ? `size per ${sizeFact.prop}` : 'size uniform';
      const rotReceipt = rotFact.kind === 'axis' ? `rotation per ${rotFact.prop}` : (Math.abs(rotOf(f)) > 0.5 ? `rotation ${rotOf(f)}deg` : 'rotation 0');
      let baseRot = rotOf(f);
      if (rotFact.kind === 'axis') {
        baseRot = rotFact.map.get(baseValueOf(rotFact.prop)) ?? [...rotFact.map.values()][0];
      }
      if (placementConds.length > 0) {
        // ENUM-GATED decor (Polaris's RadioButton dot; Carbon checkbox ✓/minus):
        // placement rides `stylesWhen` on the gating axis's shown values.
        // Wave B.1/B.2: per-value size/paint/geom/rotation join literalsByProp
        // + per-value placement styles (top/left/rotate).
        const byProp: Array<{ prop: string; map: Record<string, Record<string, string>> }> = [];
        if (sizeFact.kind === 'axis') {
          mergeByProp(byProp, sizeFact.prop, Object.fromEntries([...sizeFact.map].map(([v, s]) => [v, sizeLits(s)])));
        }
        if (paintFact.kind === 'axis') {
          mergeByProp(byProp, paintFact.prop, Object.fromEntries([...paintFact.map].map(([v, p]) => [v, paintLits(p)])));
        }
        if (geomFact.kind === 'axis') {
          mergeByProp(byProp, geomFact.prop, Object.fromEntries([...geomFact.map].map(([v, g]) => [v, geomLits(g)])));
        }
        let basePaintGated = paintOf(f);
        let baseGeomGated = offsetOf(f);
        if (paintFact.kind === 'axis') {
          basePaintGated = paintFact.map.get(baseValueOf(paintFact.prop)) ?? [...paintFact.map.values()][0];
        }
        if (geomFact.kind === 'axis') {
          baseGeomGated = geomFact.map.get(baseValueOf(geomFact.prop)) ?? [...geomFact.map.values()][0];
        }
        const rowFor = (prop: string, equals: string) =>
          rowsForFactoring.find((r) => r.combo.axisValues[prop] === equals);
        const decor: Part = {
          // When rotation factors by axis, keep it OFF the base shape — each
          // placement stylesWhen carries rotate(<n>deg) (incl. 0) so emit does
          // not leak the default-variant angle into indeterminate (Wave B.2).
          shape: {
            kind,
            width: baseSize.w,
            height: baseSize.h,
            ...(rotFact.kind === 'uniform' && Math.abs(baseRot) > 0.5 ? { rotation: baseRot } : {}),
          },
          literals: {
            ...paintLits(basePaintGated),
            ...(sizeFact.kind === 'axis' ? sizeLits(baseSize) : {}),
          },
          ...(byProp.length > 0 ? { literalsByProp: byProp } : {}),
          ...(fact.visibleWhen ? { visibleWhen: { prop: fact.visibleWhen.prop } } : {}),
          stylesWhen: [
            ...fact.hiddenWhen.map((hw) => ({ prop: hw.prop, ...(hw.equals !== undefined ? { equals: hw.equals } : {}), styles: { display: 'none' } })),
            ...placementConds.map((pc) => {
              const row = rowFor(pc.prop, pc.equals);
              const g = row ? offsetOf(row.f) : baseGeomGated;
              const rot = row ? rotOf(row.f) : baseRot;
              return {
                prop: pc.prop,
                equals: pc.equals,
                styles: {
                  position: 'absolute',
                  top: `${g.top}px`,
                  left: `${g.left}px`,
                  ...(rotFact.kind === 'axis' || Math.abs(rot) > 0.5
                    ? { transform: `rotate(${rot}deg)` }
                    : {}),
                },
              };
            }),
          ],
          description: `Drawn ${pe} pseudo-element decor promoted from the computed floor (round 5c S5 + Wave B.2 rotate): a ${baseSize.w}×${baseSize.h} ${kind} at ${baseGeomGated.left},${baseGeomGated.top} inside ${e.partName}, fill ${basePaintGated.bg} — background+box+radius; translate folded; ${rotReceipt} (receipted).`,
        };
        receipts.push(
          `pseudo-decor-carried: ${e.partName}${pe} → shape part "${partName}" (${kind} ${baseSize.w}×${baseSize.h} at ${baseGeomGated.left},${baseGeomGated.top}, fill ${basePaintGated.bg}; drawn in ${drawnRows.length}/${domain.length} default-interaction combos${fact.hiddenWhen.length ? `, hidden-when ${fact.hiddenWhen.map((hw) => (hw.equals ? `${hw.prop}=${hw.equals}` : hw.prop)).join(', ')}` : ''}; ${sizeReceipt}; ${rotReceipt}; translate${hostIsShapeLeaf ? ' + host border' : ''} folded into top/left${hostIsShapeLeaf ? '; BUBBLED to the host parent (shape leaves cannot nest children; parent content box == host border box, asserted)' : ''} — round 5c S5 + Wave B.2)`,
        );
        out.push([partName, decor]);
        continue;
      }
      // PSEUDO-DECOR v2 (D2) — UNCONDITIONAL ABSOLUTE DECOR. v1 refused
      // outright here ("stylesWhen placement has no condition to ride"), and
      // that refusal is precisely what left Carbon's checkbox with no box and
      // its toggle with no knob: both are drawn in EVERY combo, so neither
      // has a gate to hang a condition on. A decor drawn everywhere does not
      // need one — it declares `position: absolute` and carries its offsets
      // as ordinary literals, the same lowering every other absolute part in
      // the repo uses (absolutePartPlacement). Per-value geometry/paint/size
      // ride `literalsByProp`, one ordered entry per driving axis.
      const byProp: Array<{ prop: string; map: Record<string, Record<string, string>> }> = [];
      let baseGeom = offsetOf(f);
      let basePaint = paintOf(f);
      if (geomFact.kind === 'axis') {
        const base = geomFact.map.get(baseValueOf(geomFact.prop)) ?? [...geomFact.map.values()][0];
        baseGeom = base;
        mergeByProp(byProp, geomFact.prop, Object.fromEntries([...geomFact.map].map(([v, g]) => [v, geomLits(g)])));
      }
      if (sizeFact.kind === 'axis') {
        mergeByProp(byProp, sizeFact.prop, Object.fromEntries([...sizeFact.map].map(([v, s]) => [v, sizeLits(s)])));
      }
      if (paintFact.kind === 'axis') {
        const base = paintFact.map.get(baseValueOf(paintFact.prop)) ?? [...paintFact.map.values()][0];
        basePaint = base;
        mergeByProp(byProp, paintFact.prop, Object.fromEntries([...paintFact.map].map(([v, p]) => [v, paintLits(p)])));
      }
      const rotStyles: { prop: string; equals: string; styles: Record<string, string> }[] =
        rotFact.kind === 'axis'
          ? [...rotFact.map].map(([v, rot]) => ({
              prop: rotFact.prop,
              equals: v,
              styles: (Math.abs(rot) > 0.5 ? { transform: `rotate(${rot}deg)` } : {}) as Record<string, string>,
            })).filter((sw) => Object.keys(sw.styles).length > 0)
          : [];
      const decor: Part = {
        shape: {
          kind,
          width: baseSize.w,
          height: baseSize.h,
          ...(Math.abs(baseRot) > 0.5 ? { rotation: baseRot } : {}),
        },
        declared: { position: 'absolute' },
        literals: {
          ...paintLits(basePaint),
          ...geomLits(baseGeom),
          ...(sizeFact.kind === 'axis' ? sizeLits(baseSize) : {}),
        },
        ...(byProp.length > 0 ? { literalsByProp: byProp } : {}),
        ...(fact.visibleWhen ? { visibleWhen: { prop: fact.visibleWhen.prop } } : {}),
        ...((fact.hiddenWhen.length > 0 || rotStyles.length > 0)
          ? {
              stylesWhen: [
                ...fact.hiddenWhen.map((hw) => ({ prop: hw.prop, ...(hw.equals !== undefined ? { equals: hw.equals } : {}), styles: { display: 'none' } })),
                ...rotStyles,
              ],
            }
          : {}),
        description: `Drawn ${pe} pseudo-element decor promoted from the computed floor (pseudo-decor v2, Carbon live-defect round + Wave B.2): an UNCONDITIONAL ${baseSize.w}×${baseSize.h} ${kind} at ${baseGeom.left},${baseGeom.top} inside ${e.partName} — position:absolute with literal offsets${byProp.length ? `, per-value ${byProp.map((b) => b.prop).join(' + ')} overrides` : ''}; ${rotReceipt}; background+border+box+radius only, no content text; translate folded into top/left (receipted).`,
      };
      receipts.push(
        `pseudo-decor-carried: ${e.partName}${pe} → UNCONDITIONAL shape part "${partName}" (${kind} ${baseSize.w}×${baseSize.h} at ${baseGeom.left},${baseGeom.top}, fill ${basePaint.bg}${basePaint.borderColor ? `, ${Math.max(...Object.values(basePaint.borderW))}px ring ${basePaint.borderColor}` : ''}; drawn in ${drawnRows.length}/${domain.length} default-interaction combos; geometry ${geomFact.kind === 'axis' ? `per ${geomFact.prop}` : 'uniform'}, ${sizeReceipt}, paint ${paintFact.kind === 'axis' ? `per ${paintFact.prop}` : 'uniform'}, ${rotReceipt}${hostIsShapeLeaf ? '; BUBBLED to the host parent' : ''} — pseudo-decor v2)`,
      );
      out.push([partName, decor]);
    }
    return out;
  };

  /** Build a Part for a union entry (recursing into children). Returns null
   *  when the entry (and subtree) refuses promotion. */
  const buildPart = (e: UnionNode): Part | null => {
    const i = idxOf.get(e.id)!;
    if (consumed.has(i) && !svgPlans.has(i)) return null; // svg internals
    // CARBON LIVE-DEFECT ROUND (D1) — a non-painting SVG metadata element is
    // never a part. The capture drops these now; this is the promotion-side
    // backstop so a stale committed capture can never put an accessible
    // title on the canvas as visible ink.
    if (SVG_NONPAINTING.has(e.rep.tag)) {
      refusals.push(`svg-metadata-not-a-part: ${e.partName} <${e.rep.tag}> is non-painting SVG metadata (SVG 1.1 §5.4) — never promoted; its accessible text is not canvas ink`);
      return null;
    }
    const existing = staticByName.get(e.partName);
    const part: Part = existing ? structuredClone(existing) : {};
    if (existing) delete part.parts; // children re-derived from the captured tree
    // Round 5c — SHAPE GEOMETRY RECARRIED: a reviewed static shape (curated
    // decor geometry, round 2) whose numbers contradict the captured
    // computed box retires its numbers — geometry channels are excluded from
    // fusion (environment-dependent in general), but a decor box UNIFORM
    // across every enabled combo is measured truth the curation got wrong
    // (Checkbox/Radio backdrop: curated 20×20 vs the package's 18×18). The
    // curated KIND (rect/ellipse) stays the reviewed call.
    if (part.shape && (part.shape.kind === 'rect' || part.shape.kind === 'ellipse')) {
      const px = (v: string | undefined): number | null => {
        const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
        return m ? Number(m[1]) : null;
      };
      const ws = new Set<number>();
      const hs = new Set<number>();
      let readable = true;
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (!el) continue;
        const w = px(el.node.style['width']);
        const h = px(el.node.style['height']);
        if (w === null || h === null || w <= 0 || h <= 0) { readable = false; break; }
        ws.add(Math.round(w * 100) / 100);
        hs.add(Math.round(h * 100) / 100);
      }
      if (readable && ws.size === 1 && hs.size === 1) {
        const [w] = ws;
        const [h] = hs;
        if (w !== part.shape.width || h !== part.shape.height) {
          receipts.push(
            `shape-geometry-recarried: ${e.partName} — reviewed shape ${part.shape.width}×${part.shape.height} contradicts the captured computed box ${w}×${h} (uniform across every enabled combo); computed truth wins geometry, the curated numbers retire (round 5c; kind "${part.shape.kind}" stays the reviewed call)`,
          );
          part.shape = { ...part.shape, width: w, height: h };
        }
      }
    }
    if (!existing) {
      // element: captured tag (span/div default conventions preserved)
      const hasText = e.rep.nodes.some((n) => n.t === 'text' && n.v.trim().length > 0);
      if (e.rep.tag !== 'div' && !(hasText && e.rep.tag === 'span')) part.element = e.rep.tag;
      // text/content binding
      if (hasText) {
        const txt = textOf(e.rep);
        let boundProp = [...samplesByProp.entries()].find(([, v]) => v === txt)?.[0];
        // MUI round (Card live finding #2): a promoted text-holder whose text
        // IS the children sample binds content even when the contract has no
        // text prop yet — the mounted composition (CardContent holding the
        // children) is the proof; mint the children prop like the root flow.
        if (!boundProp && txt === comp.sampleText && comp.sampleText.length > 0) {
          if (!contract.props.some((p) => p.name === 'children')) {
            contract.props.push({
              name: 'children',
              type: 'text',
              default: comp.sampleText,
              description: 'Promoted from the computed floor: the mounted children render as this part\'s text (captured mount proof).',
              bindings: { figma: { kind: 'TEXT', property: 'Content' }, code: { prop: 'children' } },
            } as Contract['props'][number]);
            samplesByProp.set('children', comp.sampleText);
          }
          boundProp = 'children';
          receipts.push(`child-content-carried: ${e.partName} holds the children sample text — bound to minted text prop "children" (MUI CardContent class)`);
        }
        if (boundProp) part.content = { prop: boundProp };
        else {
          part.text = txt;
          receipts.push(`literal-text-carried: ${e.partName} = "${txt.slice(0, 40)}" (no text prop sample matches — the mounted value is carried verbatim)`);
        }
      }
      part.description = `Promoted from the computed floor (round 4): rendered anatomy ${e.sig} — this element exists in the real component's DOM; the static layer had no part for it.`;
    }

    // ═══ CONFORMANCE FRONTIER (R2) — THE GENERAL NON-PAINTING INVARIANT ═══
    //
    //  The SVG `<title>` defect (Carbon D1) was patched with a hardcoded TAG
    //  ALLOWLIST — `title`/`desc`/`metadata` — so the INVARIANT behind it was
    //  never written down and its general form kept shipping: an element that
    //  renders NO INK was promoted as ordinary, VISIBLE anatomy, text and all.
    //  Measured on the fixture: a `visibility: hidden` span carrying a sentinel
    //  string was promoted with `declared.display: "block"` and
    //  that literal text, so the contract asserted a visible block containing
    //  words the browser paints nowhere. Its `display: none` twin is SAFE for
    //  one reason only — promotion carries `declared.display: none` alongside
    //  the text, i.e. it CARRIES THE FACT THAT HIDES IT.
    //
    //  So that is the invariant, stated once and applied generally: a part
    //  that paints no ink must either CARRY THE FACT THAT HIDES IT, or be
    //  REFUSED BY NAME. It is never promoted as visible anatomy.
    //
    //  BOUNDED, and the bound is part of the rule:
    //   · `visibility: hidden|collapse` and `content-visibility: hidden`
    //     REFUSE — neither has a carried spelling, and both keep a full-size
    //     box the canvas would draw with its text.
    //   · a ZERO-SIZE box with clipped overflow REFUSES — nothing inside it
    //     can reach a pixel.
    //   · `display: none` does NOT refuse: promotion already carries
    //     `declared.display: none` (the twin above), which IS the fact that
    //     hides it — and per-axis presence factoring depends on those hidden
    //     parts surviving so a set value can restore them.
    //   · `opacity: 0` does NOT refuse: `opacity` is a registered TOKEN
    //     channel (TOKEN_CHANNELS, drawn as node opacity), so a part at zero
    //     opacity carries the fact that hides it on both surfaces.
    //   · sr-only does NOT refuse: it is handled immediately below, and it
    //     carries `declared.display: none` for exactly this reason.
    //
    //  An element is only refused when it paints nowhere in EVERY combo it
    //  appears in, AND no descendant paints (a `visibility: visible`
    //  descendant of a hidden ancestor DOES paint — refusing the ancestor
    //  would delete real ink). A part hidden in SOME combos is a state fact
    //  and rides the existing presence machinery untouched.
    {
      const paintsNowhere = (el: FlatEl | null | undefined): string | null => {
        if (!el) return null;
        const st = el.node.style;
        const vis = st['visibility'];
        if (vis === 'hidden' || vis === 'collapse') return `visibility: ${vis}`;
        if (st['content-visibility'] === 'hidden') return 'content-visibility: hidden';
        const zero = (v: string | undefined): boolean => v === '0px' || v === '0';
        const clipped = /^(hidden|clip)$/.test(st['overflow-x'] ?? '') && /^(hidden|clip)$/.test(st['overflow-y'] ?? '');
        if ((zero(st['width']) || zero(st['height'])) && clipped) return `a ${st['width']}×${st['height']} box with overflow ${st['overflow-x']}`;
        return null;
      };
      /** Does anything in this union subtree paint? `visibility` INHERITS, so
       *  a descendant may set `visibility: visible` and become real ink. */
      const subtreePaints = (node: UnionNode, comboKey: string): boolean => {
        const el = union.alignedByKey.get(comboKey)?.[idxOf.get(node.id)!];
        if (el && paintsNowhere(el) === null) return true;
        return node.children.some((k) => subtreePaints(k, comboKey));
      };
      const combos = presentBy.get(i) ?? [];
      const causes = new Set<string>();
      let everPaints = false;
      for (const combo of combos) {
        const key = `${combo.key}__default`;
        const el = union.alignedByKey.get(key)?.[i];
        if (!el) continue;
        const cause = paintsNowhere(el);
        if (cause === null || subtreePaints(e, key)) { everPaints = true; break; }
        causes.add(cause);
      }
      if (!everPaints && causes.size > 0 && !isSrOnlyStyle(e.rep.style)) {
        const text = e.rep.nodes.filter((n) => n.t === 'text' && n.v.trim()).map((n) => (n as { v: string }).v.trim()).join(' ');
        refusals.push(
          `non-painting-part: ${e.partName} <${e.rep.tag}> renders NO INK in any combo it appears in (${[...causes].sort().join('; ')}) and no descendant paints${text ? `, yet it carries the text "${text.slice(0, 60)}"` : ''} — NOT promoted. A part that paints nowhere must carry the fact that hides it (declared display:none / an opacity token) or be refused by name; neither \`visibility\` nor \`content-visibility\` has a carried spelling, so promoting this box would put a VISIBLE frame${text ? ' with visible text' : ''} on the canvas that the browser draws nowhere (the general form of the SVG <title> defect)`,
        );
        return null;
      }
    }

    // Visually-hidden (sr-only) fact: the real component clips these parts
    // out of the visual (clip-path inset(50%) / 1px clip box). The promoted
    // part carries declared display:none — visually identical; the a11y
    // surface of the GENERATED component is contract-owned (semantics/role),
    // NAMED as a downgrade receipt.
    const srOnly = isSrOnlyStyle(e.rep.style);
    if (srOnly) {
      part.declared = { ...part.declared, display: 'none' };
      receipts.push(`sr-only-carried-as-hidden: ${e.partName} is visually hidden in the real component (clip-path/1px box) — promoted with declared display:none (visual parity exact; AT semantics ride the contract's own semantics — NAMED downgrade)`);
      return part; // no children/facts needed beyond the hidden box
    }

    // Absolute-position fact: a promoted part whose computed position is
    // uniformly absolute is an overlay (Thumbnail's img fills its card) —
    // carried via the declared registry (round 4 grammar); its inset
    // channels mint like any other px channel.
    {
      const positions = new Set<string>();
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (el) positions.add(el.node.style['position']);
      }
      if (positions.size === 1 && [...positions][0] === 'absolute') {
        part.declared = { ...part.declared, position: 'absolute' };
      }
    }

    // img parts: the capture reads no attributes — src/alt are wired by
    // prop-name heuristic (source/src → src, alt/accessibilityLabel → alt),
    // receipted; without a src the promoted img is an empty broken box.
    if (e.rep.tag === 'img') {
      const findProp = (...names: string[]) => contract.props.find((pr) => pr.type === 'text' && names.includes(pr.name))?.name;
      const srcProp = findProp('source', 'src');
      const altProp = findProp('alt', 'accessibilityLabel');
      const attrs: Record<string, string> = {};
      if (srcProp) attrs['src'] = `{${srcProp}}`;
      if (altProp) attrs['alt'] = `{${altProp}}`;
      if (Object.keys(attrs).length > 0) {
        part.attrs = { ...attrs, ...part.attrs };
        receipts.push(`img-attrs-wired: ${e.partName} src/alt bound by prop-name heuristic (${Object.entries(attrs).map(([a, v]) => `${a}=${v}`).join(', ')}) — the capture reads no attributes (named)`);
      }
    }

    // Display fact: every promoted part carries its computed display
    // EXPLICITLY — the emitters default structural parts to flex, but the
    // real tree mixes block/inline containers, and a wrong container display
    // cascades (flex-item blockification turned Banner's body span into a
    // block and let a block Box render as a flex row). flex/inline-flex ride
    // Part.layout (the schema's own vocabulary; enrichLayout adds
    // direction/align/justify); other uniform keywords ride Part.declared.
    {
      const displays = new Set<string>();
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (el) displays.add(el.node.style['display']);
      }
      if (displays.size === 1) {
        const d = [...displays][0];
        if (d === 'flex' || d === 'inline-flex') {
          part.layout = { display: d as 'flex' | 'inline-flex', ...part.layout };
        } else if (/^(inline|inline-block|block|contents|none)$/.test(d)) {
          part.declared = { display: d, ...part.declared };
        } else if (d === 'list-item' || d === 'flow-root') {
          // CARBON LIVE-DEFECT ROUND (D3): `list-item` is a BLOCK-LEVEL box
          // with a marker — CSS block flow, exactly like `block`. It was
          // falling into the outside-vocabulary receipt, so Carbon's
          // `<li class="cds--accordion__item">` carried no display at all and
          // the emitter's HORIZONTAL default put the 472px panel beside the
          // 174px heading inside a 328px item. `flow-root` rides the same
          // rule (block box, own BFC).
          part.declared = { display: d, ...part.declared };
          receipts.push(`block-level-display-carried: ${e.partName} = "${d}" — a block-level box in CSS block flow; carried in the declared registry so the canvas lowers it as a stack rather than the emitter's row default`);
        } else if (d === 'grid' || d === 'inline-grid') {
          const low = lowerGridDisplay(d, e.rep.style);
          if (low && 'refusal' in low) {
            refusals.push(`${low.refusal} (part ${e.partName})`);
          } else if (low) {
            part.layout = { ...low.layout, ...part.layout };
            receipts.push(`grid-lowering: ${e.partName} ${low.note}`);
          }
        } else if (TABLE_DISPLAYS.has(d)) {
          // ORGANISM round: the CSS table box model lowered to the flex
          // vocabulary (see lowerTableDisplay). Receipted per part — the
          // canvas draws real rows/columns instead of the emitter's default
          // HORIZONTAL/CENTER/CENTER guess.
          const low = lowerTableDisplay(d, e.rep.style)!;
          part.layout = { ...low.layout, ...part.layout };
          // …and so is the ELEMENT. A promoted <tr>/<thead> outside a <table>
          // is DELETED by the HTML parser and a bare <th>/<td> ignores its
          // flex layout — the lowering must be complete or it is a silent
          // structural loss (caught by the fidelity gate: the first Table
          // capture scored 33.5% because the emitted rows were parsed away).
          // The semantics are NOT dropped: each lowered part carries the
          // matching ARIA role, which is what the table box model means.
          const role = tableRoleFor(d, e.rep.tag);
          part.element = 'div';
          if (role) part.attrs = { role, ...part.attrs };
          receipts.push(`table-lowering: ${e.partName} ${low.note}; element <${e.rep.tag}> → <div>${role ? ` role="${role}"` : ''} (a table element outside a <table> is dropped by the HTML parser — the lowering carries the semantics as ARIA)`);
        } else {
          receipts.push(`display-outside-vocabulary: ${e.partName} = "${d}" — carried by neither layout nor the declared registry (named residue)`);
        }
      } else if (displays.size > 1) {
        receipts.push(`display-varies: ${e.partName} = {${[...displays].sort().join(', ')}} across combos — no per-axis display spelling (named residue)`);
      }
    }

    // Aspect fact (geometry evidence): computed width == height in EVERY
    // enabled combo (>0, ≥2 distinct sizes or a sized axis) — the real
    // component keeps the square via pseudo-element padding hacks (Avatar's
    // ::after) that anatomy cannot carry; the RATIO is the carried fact.
    {
      const px = (v: string | undefined): number | null => {
        const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
        return m ? Number(m[1]) : null;
      };
      let square = false;
      const sizes = new Set<number>();
      for (const combo of presentBy.get(i) ?? []) {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (!el) { square = false; break; }
        const w = px(el.node.style['width']);
        const h = px(el.node.style['height']);
        if (w === null || h === null || w <= 0 || Math.abs(w - h) > 0.6) { square = false; break; }
        sizes.add(Math.round(w));
        square = true;
      }
      // require ≥2 observed sizes: a single square observation could be
      // coincidence; a size axis driving both dimensions is the evidence.
      if (square && sizes.size >= 2) {
        part.declared = { ...part.declared, 'aspect-ratio': '1 / 1' };
        receipts.push(`aspect-carried: ${e.partName} computed width == height in every enabled combo (${[...sizes].sort((a, b) => a - b).join('/')}px) → declared aspect-ratio 1 / 1 (geometry evidence; the real square rides a pseudo-element padding hack)`);
      }
    }

    // Full-width fact (geometry evidence): a part inside a ROW flex parent
    // whose computed width equals the parent's content width in EVERY
    // enabled combo spans the row — carried as layout.grow (flex: 1 1 auto),
    // the schema's own spelling. Without it, promoted containers hug and
    // justify: space-between has no room to justify (the Banner dismiss ×
    // rendered next to the title instead of at the ribbon's right edge).
    if (e.parent) {
      const pi = idxOf.get(e.parent.id)!;
      const px = (v: string | undefined): number | null => {
        const m = /^(-?\d+(?:\.\d+)?)px$/.exec(v ?? '');
        return m ? Number(m[1]) : null;
      };
      let fullWidth = false;
      for (const combo of presentBy.get(i) ?? []) {
        const els = union.alignedByKey.get(`${combo.key}__default`)!;
        const self = els[i];
        const parent = els[pi];
        if (!self || !parent) { fullWidth = false; break; }
        const ps = parent.node.style;
        if (ps['display'] !== 'flex' && ps['display'] !== 'inline-flex') { fullWidth = false; break; }
        const dir = ps['flex-direction'] ?? 'row';
        if (dir !== 'row') { fullWidth = false; break; }
        const w = px(self.node.style['width']);
        const pw = px(ps['width']);
        const padL = px(ps['padding-left']) ?? 0;
        const padR = px(ps['padding-right']) ?? 0;
        if (w === null || pw === null) { fullWidth = false; break; }
        if (Math.abs(w - (pw - padL - padR)) > 0.6) { fullWidth = false; break; }
        fullWidth = true;
      }
      if (fullWidth) {
        part.layout = { ...part.layout, grow: true };
        receipts.push(`full-width-carried: ${e.partName} spans its row parent's content width in every enabled combo → layout.grow (geometry evidence)`);
      }
    }

    // presence facts
    const present = presentBy.get(i) ?? [];
    if (present.length < enabled.length) {
      const contractPropNames = new Set(contract.props.map((p) => p.name));
      const fact = factorPresence(present, enabled, space.axes, presenceProps, stateProps, e.partName, contractPropNames);
      if (!fact) {
        // Round 5c: complement-of-product fallback — a default subtree an
        // alternative replaces (Tag's label under `linked`) is spellable as
        // an ordered hide→restore stylesWhen cascade, verified per combo.
        const comp5c = factorComplement(
          presentAllBy.get(i) ?? new Set(),
          allDefaultCombos,
          space.axes,
          presenceProps,
          stateProps,
          e.partName,
          contractPropNames,
        );
        if (comp5c) {
          const restore =
            part.layout?.display ??
            (part.declared?.['display'] && part.declared['display'] !== 'none' ? part.declared['display'] : undefined) ??
            (e.children.length > 0 ? 'flex' : 'inline');
          part.stylesWhen = [
            ...(part.stylesWhen ?? []),
            ...comp5c.hide.map((h) => ({ prop: h.prop, ...(h.equals !== undefined ? { equals: h.equals } : {}), styles: { display: 'none' } })),
            ...comp5c.restore.map((r) => ({ prop: r.prop, ...(r.equals !== undefined ? { equals: r.equals } : {}), styles: { display: String(restore) } })),
          ];
          receipts.push(...comp5c.receipts);
        } else {
          refusals.push(`part-presence-uncorrelated: ${e.partName} present in ${present.length}/${enabled.length} enabled combos and the presence set does not factor per-axis (nor does its ABSENCE — the round-5c complement spelling was tried) — part NOT promoted (named refusal; a phantom always-drawn part would be worse)`);
          return null;
        }
      } else {
        if (fact.visibleWhen) part.visibleWhen = { prop: fact.visibleWhen.prop };
        if (fact.shownWhen.length > 0) {
          // Round 5f: this part is ABSENT at unset and appears per SET value —
          // its gating axis is a defaultless STRUCTURE-creating enum. Record
          // it so the unset value materializes into the enum as the default
          // (the plain, adornment-absent variant).
          for (const sw of fact.shownWhen) structureGatingUnsetAxes.add(sw.prop);
          // base-hidden: declared display none; each SET value restores the
          // part's own uniform display (captured; flex default for containers)
          const restore =
            part.layout?.display ??
            (part.declared?.['display'] && part.declared['display'] !== 'none' ? part.declared['display'] : undefined) ??
            (Object.keys(e.children).length > 0 ? 'flex' : 'inline');
          part.declared = { ...part.declared, display: 'none' };
          part.stylesWhen = [
            ...(part.stylesWhen ?? []),
            ...fact.shownWhen.map((sw) => ({ prop: sw.prop, equals: sw.equals, styles: { display: String(restore) } })),
          ];
        }
        if (fact.hiddenWhen.length > 0) {
          part.stylesWhen = [
            ...(part.stylesWhen ?? []),
            ...fact.hiddenWhen.map((hw) => ({ prop: hw.prop, ...(hw.equals !== undefined ? { equals: hw.equals } : {}), styles: { display: 'none' } })),
          ];
        }
        receipts.push(...fact.receipts);
        receipts.push(
          `presence-carried: ${e.partName} (${present.length}/${enabled.length} combos) → ${part.visibleWhen ? `visibleWhen ${part.visibleWhen.prop}` : ''}${fact.shownWhen.length ? ` base-hidden, shown-when ${fact.shownWhen.map((h) => `${h.prop}=${h.equals}`).join(', ')}` : ''}${fact.hiddenWhen.length ? ` hidden-when ${fact.hiddenWhen.map((h) => h.equals ? `${h.prop}=${h.equals}` : h.prop).join(', ')}` : ''}`,
        );
      }
    }

    // svg host → icon part(s)
    const plan = svgPlans.get(i);
    if (plan) {
      applySvgPlan(part, e, plan);
      return part;
    }

    // children
    const childParts: Record<string, Part> = {};
    for (const c of e.children) {
      const cp = buildPart(c);
      if (cp) childParts[c.partName] = cp;
      // Round 5c — S5 bubbling: a shape-leaf child's drawn pseudo decor
      // cannot nest inside it — it joins THIS part's children instead.
      if (cp?.shape) {
        for (const [decorName, decor] of pseudoDecorParts(c, idxOf.get(c.id)!, true)) childParts[decorName] = decor;
      }
    }
    // Round 5c — S5: drawn pseudo-element decor boxes join as child parts.
    if (!part.shape) {
      for (const [decorName, decor] of pseudoDecorParts(e, i, false)) childParts[decorName] = decor;
    }
    if (Object.keys(childParts).length > 0) part.parts = childParts;
    // CARBON LIVE-DEFECT ROUND (D6) — INERT OVERLAY WRAPPER.
    //
    // In Carbon an icon button IS a tooltip trigger, so its captured anatomy
    // carries `span.cds--popover` — an absolutely-positioned wrapper whose
    // whole subtree is `display:none` until the tooltip opens. Promoted, it
    // became a 24×24 ABSOLUTE frame sitting over the entire component that
    // draws nothing at all (the live tree's "invisible absolute tooltip
    // part"). This is the census-capture sibling of the portal round's
    // `stripInertPortalChildren`: what paints nothing, contains nothing
    // visible, and says nothing is not anatomy.
    //
    // BOUNDED: the part must paint no box in EVERY captured combo, carry no
    // ink of its own (no text/icon/shape/component/slot), and have at least
    // one child with EVERY child declared `display:none`. A childless
    // paintless frame is LEFT ALONE — it can be a real spacer, and this
    // round has no measurement that says otherwise.
    {
      const kids = Object.values(childParts);
      const inkless = !part.text && !part.icon && !part.shape && !part.component && !part.slot;
      const paintsNothing = (presentBy.get(i) ?? []).every((combo) => {
        const el = union.alignedByKey.get(`${combo.key}__default`)![i];
        if (!el) return true;
        const s = el.node.style;
        const bg = s['background-color'];
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return false;
        if (['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'].some((p) => s[p] !== undefined && s[p] !== '0px')) return false;
        if (s['box-shadow'] && s['box-shadow'] !== 'none') return false;
        if (s['background-image'] && s['background-image'] !== 'none') return false;
        return true;
      });
      if (
        inkless &&
        paintsNothing &&
        part.declared?.['display'] !== 'none' &&
        kids.length > 0 &&
        kids.every((k) => k.declared?.['display'] === 'none')
      ) {
        refusals.push(
          `inert-overlay-wrapper: ${e.partName} draws no box in any captured combo, carries no text/icon/shape of its own, and every one of its ${kids.length} child part(s) is declared display:none — a carried part that draws NOTHING; refused by name (Carbon's tooltip \`popover\` wrapper; census sibling of the portal round's stripInertPortalChildren)`,
        );
        return null;
      }
    }
    return part;
  };

  // root: keep the reviewed root part's facts, replace its children with the
  // captured nesting; unmatched static parts are re-attached afterwards.
  const newRoot = structuredClone(rootPart);
  delete newRoot.parts;
  // Root display fact: computed truth wins the display channel (the static
  // extraction's layout.display is a source-reading guess; TextField's root
  // is a block in the browser, and a flex guess put the label beside the
  // field) — override is RECEIPTED, never silent.
  {
    const displays = new Set<string>();
    for (const combo of enabled) {
      const el = union.alignedByKey.get(`${combo.key}__default`)?.[0];
      if (el) displays.add(el.node.style['display']);
    }
    if (displays.size === 1) {
      const d = [...displays][0];
      if (d === 'flex' || d === 'inline-flex') {
        if (newRoot.layout?.display !== d) {
          receipts.push(`root-display-carried: ${d}${newRoot.layout?.display ? ` (overrides reviewed "${newRoot.layout.display}" — computed truth wins display, receipted)` : ''}`);
        }
        newRoot.layout = { ...newRoot.layout, display: d };
      } else if (/^(inline|inline-block|block|contents)$/.test(d)) {
        if (newRoot.layout?.display) {
          receipts.push(`root-display-carried: ${d} via declared (overrides reviewed layout.display "${newRoot.layout.display}" — computed truth wins display, receipted)`);
          delete newRoot.layout.display;
          if (Object.keys(newRoot.layout).length === 0) delete newRoot.layout;
        }
        newRoot.declared = { display: d, ...newRoot.declared };
      } else if (d === 'list-item' || d === 'flow-root') {
        // D3, root edition — the same block-level carry as a promoted part.
        newRoot.declared = { display: d, ...newRoot.declared };
        receipts.push(`root-display-carried: ${d} via declared (a block-level box in CSS block flow)`);
      } else if (d === 'grid' || d === 'inline-grid') {
        const low = lowerGridDisplay(d, rootEntry.rep.style);
        if (low && 'refusal' in low) refusals.push(`${low.refusal} (root)`);
        else if (low) {
          newRoot.layout = { ...low.layout, ...newRoot.layout };
          receipts.push(`grid-lowering: root ${low.note}`);
        }
      } else if (TABLE_DISPLAYS.has(d)) {
        // ORGANISM round: a display:table ROOT (the Table organism) lowers
        // exactly like a promoted part — the root is the column stack its
        // row groups fill.
        const low = lowerTableDisplay(d, rootEntry.rep.style)!;
        newRoot.layout = { ...low.layout, ...newRoot.layout };
        const rootRole = tableRoleFor(d, rootEntry.rep.tag);
        if (rootRole && contract.semantics.role === undefined) {
          contract.semantics.role = rootRole;
          receipts.push(`table-lowering: root semantics.role minted "${rootRole}" — the root's table box model is lowered to flex, and the reviewed contract declared no role (the meaning must not be lost with the display)`);
        }
        receipts.push(`table-lowering: root ${low.note}${contract.semantics.element !== 'div' ? ` — NOTE reviewed semantics.element is <${contract.semantics.element}>, which the code generator will emit outside any <table>` : ''}`);
      }
    }
  }
  const rootChildren: Record<string, Part> = {};
  for (const c of rootEntry.children) {
    const cp = buildPart(c);
    if (cp) rootChildren[c.partName] = cp;
  }
  // Round 5c — S5 on the root itself (drawn root pseudo decor) + bubbling
  // for the root's own shape-leaf children.
  for (const c of rootEntry.children) {
    if (rootChildren[c.partName]?.shape) {
      for (const [decorName, decor] of pseudoDecorParts(c, idxOf.get(c.id)!, true)) rootChildren[decorName] = decor;
    }
  }
  for (const [decorName, decor] of pseudoDecorParts(rootEntry, idxOf.get(rootEntry.id)!, false)) rootChildren[decorName] = decor;
  if (Object.keys(rootChildren).length > 0) newRoot.parts = rootChildren;
  // MUI round (Card live finding): the ROOT itself can hold direct text runs
  // — MUI's Card renders children as a BARE text node (no wrapping element,
  // so no child part exists to carry content, and the text silently vanished
  // from the canvas). Bind root content exactly as buildPart binds promoted
  // text holders; when the mounted text is the children sample and the
  // contract has no text prop, MINT a children-bound one — the captured
  // mount is the proof the surface accepts text children.
  {
    const rootText = textOf(rootEntry.rep);
    const carriesContent = (p: Part): boolean =>
      p.content !== undefined || p.text !== undefined || Object.values(p.parts ?? {}).some(carriesContent);
    if (rootText.length > 0 && !carriesContent(newRoot)) {
      let boundProp = [...samplesByProp.entries()].find(([, v]) => v === rootText)?.[0];
      if (!boundProp && rootText === comp.sampleText && comp.sampleText.length > 0) {
        const propName = 'children';
        if (!contract.props.some((p) => p.name === propName)) {
          contract.props.push({
            name: propName,
            type: 'text',
            default: comp.sampleText,
            description: 'Promoted from the computed floor: the root renders its children as direct text (captured mount proof).',
            bindings: { figma: { kind: 'TEXT', property: 'Content' }, code: { prop: 'children' } },
          } as Contract['props'][number]);
        }
        boundProp = propName;
      }
      if (boundProp) {
        newRoot.content = { prop: boundProp };
        receipts.push(`root-content-carried: the root holds direct text ("${rootText.slice(0, 30)}") with no text-holder child part — bound to text prop "${boundProp}" (MUI Card class)`);
      } else {
        newRoot.text = rootText;
        receipts.push(`root-literal-text-carried: root direct text "${rootText.slice(0, 30)}" matches no prop sample — carried verbatim (named)`);
      }
    }
  }
  // Round 5c — ROOT-HOSTED svg plan: buildPart never runs on the root, so a
  // plan whose host IS the root (Spinner: the glyph is the root's only
  // child) was silently dropped — the assets existed, the contract carried
  // no glyph. Apply it here exactly as buildPart applies it to nested hosts.
  {
    const rootPlan = svgPlans.get(idxOf.get(rootEntry.id)!);
    if (rootPlan) {
      newRoot.parts = rootChildren; // per-value children merge into the same map
      applySvgPlan(newRoot, rootEntry, rootPlan);
      receipts.push(
        `root-svg-plan-carried: ${comp.name} root hosts ${rootPlan.perValue.length === 1 && rootPlan.perValue[0].value === undefined ? `icon asset ${rootPlan.perValue[0].asset}` : `${rootPlan.perValue.length} per-value glyph part(s) (${rootPlan.perValue.map((pv) => pv.asset).join(', ')})`} — round 5c root-hosted svg plan (the round-5a named promotion drop)`,
      );
    }
  }

  // static parts that neither matched nor re-joined: kept OUT (they never
  // rendered in any captured combo — drawing them would be phantom ink), a
  // named receipt each. Their reviewed facts are recoverable from the static
  // contract in git.
  const promotedNames = new Set<string>();
  const collectNames = (p: Part, name: string) => {
    promotedNames.add(name);
    for (const [n, c] of Object.entries(p.parts ?? {})) collectNames(c, n);
  };
  collectNames(newRoot, 'root');
  for (const [name] of staticByName) {
    if (!promotedNames.has(name)) {
      refusals.push(`static-part-unrendered: reviewed static part "${name}" has no rendered counterpart in ANY captured combo — dropped from the promoted anatomy (named; usually a conditional the sweep never triggered)`);
    }
  }

  contract.anatomy = { root: newRoot };
  entries.forEach((e, i) => {
    if (promotedNames.has(e.partName)) partIndex.set(e.partName, i);
  });

  // ORPHAN-ASSET ROUND (task #42): an icon asset whose HOST PART the promotion
  // just refused belongs to nothing. It used to be written to
  // examples/<lib>/assets/icons/ by promote-floor and referenced by no
  // contract — a committed SVG file for a part that does not exist. Dropped
  // here, by NAME, at the same door that decides the part.
  for (const [name, owner] of [...assetOwner].sort()) {
    if (promotedNames.has(owner) || !assets.has(name)) continue;
    assets.delete(name);
    refusals.push(
      `orphan-asset-dropped: icon asset "${name}" was reconstructed from the svg subtree of part "${owner}", which this promotion then REFUSED (see the named refusal above) — the asset belongs to no part of the promoted contract and is not carried. Before this door it was committed to the library's assets/icons/ directory and referenced by nothing (measured: examples/mui/assets/icons/autocomplete-autocomplete-clearindicator.svg).`,
    );
  }

  // Round 5f — materialize the UNSET pseudo-value of every defaultless
  // structure-gating enum into the contract enum AS THE DEFAULT. Only axes
  // whose gated part actually survived promotion count (a part refused
  // upstream leaves no plain variant to enumerate). This is the ONE place the
  // API surface gains the unset value; downstream (emit variants, gate
  // deriveCells, real-page mount) all read the enum uniformly, and the
  // gate/real-page omit the unset value on mount exactly as the capture's own
  // comboProps does (prop absent === adornment absent).
  const survivingGateProps = new Set<string>();
  const collectGates = (p: Part) => {
    if (p.declared?.['display'] === 'none') {
      for (const sw of p.stylesWhen ?? []) {
        if (sw.equals !== undefined && sw.styles['display'] !== undefined && sw.styles['display'] !== 'none') {
          survivingGateProps.add(sw.prop);
        }
      }
    }
    for (const c of Object.values(p.parts ?? {})) collectGates(c);
  };
  collectGates(newRoot);
  for (const axProp of structureGatingUnsetAxes) {
    if (!survivingGateProps.has(axProp)) continue;
    const ax = space.axes.find((a) => a.prop === axProp);
    if (!ax || ax.unset === undefined) continue;
    const prop = contract.props.find((p) => p.name === axProp);
    if (!prop || typeof prop.type !== 'object' || !('enum' in prop.type)) continue;
    if (prop.type.enum.includes(ax.unset) || prop.default !== undefined) continue;
    prop.type.enum = [ax.unset, ...prop.type.enum];
    (prop as { default?: unknown }).default = ax.unset;
    receipts.push(
      `optional-adornment-unset-materialized: ${axProp} — defaultless enum gates a present-only-when-set part; unset value "${ax.unset}" added to the enum as the DEFAULT so a PLAIN (adornment-absent) variant is enumerated and the base-hidden part renders nothing there (round 5f — S2 unset extended from styling to STRUCTURE)`,
    );
  }

  return { contract, assets, consumed, partIndex, receipts, refusals };
}

// ===========================================================================
// DEPTH BUILD — Stage B: multi-root union + promotion.
//
// The census single-root machinery (buildUnion / nameUnion / promoteAnatomy)
// is REUSED per real-root index — nothing in those functions changes. A
// portalCapture component's new roots are descended (descendToRealRoots) to
// the real root set, then each root gets its own union and its own promoted
// Part subtree; the subtrees are assembled into a multi-root
// `anatomy: Record<string, Part>` (already legal in the schema — walkAnatomy
// iterates every top-level entry). For a SINGLE real root the top-level key is
// 'root' and the output is byte-identical to promoteAnatomy alone.
// ===========================================================================

/** Count Part nodes in a promoted subtree (the part-count receipt). */
export function countParts(p: Part): number {
  return 1 + Object.values(p.parts ?? {}).reduce((n, c) => n + countParts(c), 0);
}
/** Tree depth of a promoted subtree (the depth receipt). */
export function treeDepthPart(p: Part): number {
  const kids = Object.values(p.parts ?? {});
  return kids.length === 0 ? 1 : 1 + Math.max(...kids.map(treeDepthPart));
}

export interface MultiRootUnion {
  /** One entry per real root (index-aligned to the base combo's real roots). */
  roots: Array<{ name: string; union: UnionResult; baseRoot: CapturedNode }>;
  receipts: string[];
}

/** Build a per-real-root union set from portal captures. Each combo's new
 *  roots are descended to their real root(s); root index r gets a single-root
 *  union built by the census `buildUnion` (+ `nameUnion`). Combos whose real-
 *  root COUNT differs from the base are excluded with a named receipt (overlay
 *  multi-combo root alignment is Stage C+; the Stage-B receipt is single-combo). */
export function buildMultiRootUnion(
  combos: Array<{ combo: string; interaction: string; newRoots: CapturedNode[] }>,
  baseKey: string,
  componentName: string,
  classPrefix: string,
): MultiRootUnion {
  const perCombo = combos.map((c) => ({
    combo: c.combo,
    interaction: c.interaction,
    real: c.newRoots.flatMap((r) => descendToRealRoots(r, classPrefix)),
  }));
  const base = perCombo.find((c) => `${c.combo}__${c.interaction}` === baseKey);
  if (!base) throw new Error(`multi-root union: base ${baseKey} not among combos`);
  const rootCount = base.real.length;
  const receipts: string[] = [];
  const roots: MultiRootUnion['roots'] = [];
  for (let r = 0; r < rootCount; r++) {
    const perRootCaptures: Capture[] = perCombo
      .filter((c) => c.real.length === rootCount)
      .map((c) => ({ combo: c.combo, interaction: c.interaction, root: c.real[r] }));
    const baseCap = perRootCaptures.find((c) => `${c.combo}__${c.interaction}` === baseKey)!;
    const union = buildUnion(perRootCaptures, baseCap, classPrefix);
    nameUnion(union.entries, componentName, classPrefix);
    roots.push({ name: rootPartName(base.real[r], classPrefix, r, rootCount), union, baseRoot: base.real[r] });
    receipts.push(...union.receipts);
  }
  for (const c of perCombo) {
    if (c.real.length !== rootCount) {
      receipts.push(
        `multi-root-count-varies: ${c.combo}__${c.interaction} descended to ${c.real.length} real root(s) ≠ base ${rootCount} — combo excluded from the union (named; overlay multi-combo root alignment is Stage C+)`,
      );
    }
  }
  return { roots, receipts: [...new Set(receipts)] };
}

export interface MultiRootPromotion {
  /** Static contract clone with a MULTI-ROOT promoted anatomy. */
  contract: Contract;
  assets: Map<string, string>;
  receipts: string[];
  refusals: string[];
  /** Top-level anatomy keys in order (Modal → ['dialog','backdrop']). */
  rootNames: string[];
  /** Total promoted parts across every root. */
  partCount: number;
  /** Max tree depth across roots. */
  depth: number;
}

/** Promote a multi-root union into one contract whose `anatomy` carries one
 *  top-level Part per real root. Each root reuses the census `promoteAnatomy`
 *  verbatim; the promoted `root` part is re-keyed by its real-root name
 *  (dialog / backdrop). A single real root keys as 'root' → byte-identical to
 *  `promoteAnatomy` alone (the regression-guard invariant). */
export function promoteMultiRootAnatomy(
  space: PropSpace,
  comp: ComponentConfig,
  multi: MultiRootUnion,
  componentKebab: string,
): MultiRootPromotion {
  const anatomy: Record<string, Part> = {};
  const assets = new Map<string, string>();
  const receipts = [...multi.receipts];
  const refusals: string[] = [];
  let contract: Contract | null = null;
  const usedNames = new Map<string, number>();
  for (const { name, union } of multi.roots) {
    const p = promoteAnatomy(space, comp, union, componentKebab);
    if (!contract) contract = p.contract;
    for (const [k, v] of p.assets) assets.set(k, v);
    receipts.push(...p.receipts);
    refusals.push(...p.refusals);
    const n = usedNames.get(name) ?? 0;
    usedNames.set(name, n + 1);
    anatomy[n > 0 ? `${name}-${n + 1}` : name] = p.contract.anatomy['root'];
  }
  contract = contract ?? (structuredClone(space.contract) as Contract);
  contract.anatomy = anatomy;
  const rootNames = Object.keys(anatomy);
  const partCount = Object.values(anatomy).reduce((s, part) => s + countParts(part), 0);
  const depth = rootNames.length ? Math.max(...Object.values(anatomy).map(treeDepthPart)) : 0;
  return { contract, assets, receipts: [...new Set(receipts)], refusals, rootNames, partCount, depth };
}
